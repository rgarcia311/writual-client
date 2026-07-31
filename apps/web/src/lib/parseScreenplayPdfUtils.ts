import type { ScreenplayElementType } from '@/components/ScreenplayEditor/ScreenplayExtension'
import {
  SCREENPLAY_MARGIN_BOTTOM_PX,
  SCREENPLAY_MARGIN_RIGHT_PX,
  SCREENPLAY_MARGIN_TOP_PX,
  SCREENPLAY_PAPER_WIDTH_PX,
} from '@/components/ScreenplayEditor/screenplayPaperLayout'
import { PT_PER_INCH, PX_PER_INCH } from './screenplayLayout'

/** Scene heading prefix including reversed INT/EXT intercuts. */
export const SCENE_HEADING_RE =
  /^(INT\.|EXT\.|INT\.?\s*\/\s*EXT\.|EXT\.?\s*\/\s*INT\.|I\/E\.?)\s+/i

export const MORE_LINE_RE = /^\(MORE\)\s*$/i
export const MORE_INLINE_RE = /\s*\(MORE\)\s*/gi
export const CONT_RE = /\(CONT['']D\)/i
export const CONTD_ONLY_RE = /^\(CONT['']D\)\s*$/i
export const PAGE_NUMBER_RE = /^\d{1,4}\.?$/

/** Min horizontal gap (PDF pt) between character-column clusters on one row. */
export const DUAL_COLUMN_CLUSTER_GAP_PT = 40

function pxToPt(px: number): number {
  return (px * PT_PER_INCH) / PX_PER_INCH
}

/** Fallback action left margin (1.5" @ 72pt/in). */
export const DEFAULT_BASE_X_PT = 108

/** Element offsets from calibrated baseX (1 inch = 72pt). */
export const RELATIVE_BAND_OFFSET_PT = {
  action: 0,
  dialogue: 72,
  parenthetical: 115,
  character: 158,
  transition: 300,
} as const

/**
 * Dual-column cluster ranges, computed relative to the document's *calibrated* baseX (not the
 * fixed default) — dual-dialogue columns in a given PDF sit at whatever the document's real
 * margins are, which can differ from the WGA-standard fallback assumed by `DEFAULT_BASE_X_PT`.
 */
export function characterRangeMinPt(baseX: number): number {
  return baseX + RELATIVE_BAND_OFFSET_PT.character - 36
}
export function dialogueRangeMinPt(baseX: number): number {
  return baseX + RELATIVE_BAND_OFFSET_PT.dialogue - 36
}
export const MARGIN_DUAL_CHARACTER_MAX = pxToPt(
  SCREENPLAY_PAPER_WIDTH_PX - SCREENPLAY_MARGIN_RIGHT_PX - 60,
)
export const MARGIN_DUAL_DIALOGUE_MAX = MARGIN_DUAL_CHARACTER_MAX
/** Bottom margin band for (MORE) artifact detection. */
export const PAGE_MARGIN_BOTTOM_PT = pxToPt(SCREENPLAY_MARGIN_BOTTOM_PX)
/** Top margin band for standalone (CONT'D) artifact detection. */
export const PAGE_MARGIN_TOP_PT = pxToPt(SCREENPLAY_MARGIN_TOP_PX)

type BodyBand = 'action' | 'dialogue' | 'parenthetical' | 'character'

const BAND_PRIORITY: BodyBand[] = ['character', 'parenthetical', 'dialogue', 'action']

/**
 * Textual signature of a parenthetical: the entire (trimmed) line is one parens-wrapped phrase,
 * e.g. "(annoyed)" or "(sitting up)". Real screenplays are near-universally consistent about this,
 * which makes it a far more reliable signal than x-position alone — some source PDFs' parenthetical
 * column sits closer to the dialogue band than our default `RELATIVE_BAND_OFFSET_PT.parenthetical`
 * assumes, which otherwise misclassifies every parenthetical as dialogue and merges it into the
 * following dialogue line (losing the parenthetical's distinct indentation entirely).
 */
const PARENTHETICAL_TEXT_RE = /^\(.+\)$/

export interface PdfRowItem {
  x: number
  str: string
  w: number
}

export interface ParseLineGroup {
  x: number
  right: number
  y: number
  text: string
  pageNum: number
}

/** Collapse whitespace before scene-heading / classification checks. */
export function normalizeLineText(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim()
}

export function isSceneHeading(text: string): boolean {
  return SCENE_HEADING_RE.test(normalizeLineText(text))
}

export function stripPaginationMarkerText(text: string): string {
  return normalizeLineText(text.replace(MORE_INLINE_RE, ' ').replace(CONT_RE, ''))
}

/**
 * Detect the document's action left margin by frequency among *paragraph-start* lines in the
 * action column zone (30–250pt), returning the mode; fallback 108pt.
 *
 * Counts only the first line of each paragraph (a new page, or a >18pt Y-gap from the previous
 * line) rather than every wrapped line. Counting every line biases the mode toward whichever
 * column has the most *total wrapped lines* rather than the most *paragraphs* — in a
 * dialogue-heavy script, multi-line speeches can out-number action paragraphs in raw line count
 * even though action paragraphs are still more numerous, which previously miscalibrated baseX to
 * the dialogue column instead of the action column.
 */
export function findBaseX(lines: ParseLineGroup[]): number {
  const freq = new Map<number, number>()
  let lastY: number | null = null
  let lastPageNum: number | null = null

  for (const line of lines) {
    const isParagraphStart =
      lastY === null || lastPageNum !== line.pageNum || Math.abs(lastY - line.y) > 18
    lastY = line.y
    lastPageNum = line.pageNum

    if (!isParagraphStart) continue
    if (line.x < 30 || line.x > 250) continue
    const key = Math.round(line.x)
    freq.set(key, (freq.get(key) ?? 0) + 1)
  }
  if (freq.size === 0) return DEFAULT_BASE_X_PT

  let bestX = DEFAULT_BASE_X_PT
  let bestCount = 0
  for (const [x, count] of freq) {
    if (count > bestCount) {
      bestCount = count
      bestX = x
    }
  }
  return bestX
}

/**
 * Classify a body line by nearest X band relative to the calibrated baseX.
 * Tie-break priority: character > parenthetical > dialogue > action.
 * Sluglines share the action left margin — distinguished only by INT./EXT. prefix.
 */
export function classifyElementTypeRelative(
  xPt: number,
  text: string,
  baseX: number,
): ScreenplayElementType {
  if (xPt >= baseX + RELATIVE_BAND_OFFSET_PT.transition) {
    return 'transition'
  }

  const bands: Array<{ type: BodyBand; x: number }> = [
    { type: 'action', x: baseX + RELATIVE_BAND_OFFSET_PT.action },
    { type: 'dialogue', x: baseX + RELATIVE_BAND_OFFSET_PT.dialogue },
    { type: 'parenthetical', x: baseX + RELATIVE_BAND_OFFSET_PT.parenthetical },
    { type: 'character', x: baseX + RELATIVE_BAND_OFFSET_PT.character },
  ]

  let best: BodyBand = 'action'
  let bestDist = Infinity

  for (const band of bands) {
    const dist = Math.abs(xPt - band.x)
    if (dist < bestDist) {
      bestDist = dist
      best = band.type
    } else if (dist === bestDist && BAND_PRIORITY.indexOf(band.type) < BAND_PRIORITY.indexOf(best)) {
      best = band.type
    }
  }

  // Text-pattern override: a full-line parenthetical is virtually never actually action or
  // dialogue, regardless of which x-band it landed nearest to on this particular document.
  if ((best === 'dialogue' || best === 'action') && PARENTHETICAL_TEXT_RE.test(text.trim())) {
    return 'parenthetical'
  }

  if (best === 'action' && SCENE_HEADING_RE.test(normalizeLineText(text))) {
    return 'slugline'
  }

  return best
}

/** pdf.js Y origin is bottom-left; page numbers sit in the top 2" right half. */
export function isPageNumberArtifact(line: ParseLineGroup, pageHeightPt: number): boolean {
  if (!PAGE_NUMBER_RE.test(line.text.trim())) return false
  const topThreshold = pageHeightPt - 144
  if (line.y <= topThreshold) return false
  return line.x > 300
}

/**
 * Forced (MORE) lines at the bottom margin (low Y in bottom-up coords), OR a `(MORE)`-only line
 * that is the last non-empty line on its page regardless of exact Y — bottom-margin geometry
 * varies enough across PDF exporters that a real `(MORE)` can sit just outside the Y band. The
 * text pattern is specific enough (`^\(MORE\)\s*$`) that being the final line of a page is strong
 * independent evidence on its own, without needing to widen the Y band (which would risk
 * stripping short, legitimate bottom-of-page dialogue/parentheticals like "(beat)").
 */
export function isMoreArtifact(
  line: ParseLineGroup,
  _pageHeightPt: number,
  isLastLineOnPage: boolean,
): boolean {
  if (!MORE_LINE_RE.test(line.text.trim())) return false
  return isLastLineOnPage || line.y <= PAGE_MARGIN_BOTTOM_PT + pxToPt(24)
}

/** Standalone (CONT'D) injected at the top of a continuation page. */
export function isContdArtifact(line: ParseLineGroup, pageHeightPt: number): boolean {
  const trimmed = line.text.trim()
  if (!CONTD_ONLY_RE.test(trimmed)) return false
  const topThreshold = pageHeightPt - PAGE_MARGIN_TOP_PT - pxToPt(24)
  return line.y >= topThreshold
}

/**
 * Skip duplicate character cues injected mid-dialogue when a page break splits speech.
 * The editor's (CONT'D) plugin handles continuation visually.
 */
export function shouldSkipContdCharacterCue(
  elementType: ScreenplayElementType,
  rawText: string,
  lastBlockType: ScreenplayElementType | null,
): boolean {
  if (elementType !== 'character') return false
  if (!CONT_RE.test(rawText)) return false
  return lastBlockType === 'dialogue' || lastBlockType === 'parenthetical'
}

export function shouldMergeElementTypes(
  elementType: ScreenplayElementType,
  lastElementType: ScreenplayElementType | null,
): boolean {
  if (!lastElementType || lastElementType !== elementType) return false
  return elementType === 'action' || elementType === 'dialogue' || elementType === 'parenthetical'
}

/** Join de-wrapped PDF rows into one continuous string (no newlines). */
export function mergeScriptBlockText(existing: string, addition: string): string {
  const joinsHyphenatedWord = /[\p{L}\d]-$/u.test(existing) && /^[\p{L}\d]/u.test(addition)
  const separator = joinsHyphenatedWord ? '' : ' '
  return existing + separator + addition
}

export function joinTextRunsToLine(rowItems: Array<{ x: number; str: string }>): string {
  if (rowItems.length === 0) return ''
  const sorted = [...rowItems].sort((a, b) => a.x - b.x)
  return normalizeLineText(sorted.map((it) => it.str).join(' '))
}

function clusterByGap(items: PdfRowItem[], gapPt: number): PdfRowItem[][] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => a.x - b.x)
  const clusters: PdfRowItem[][] = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (cur.x - prev.x > gapPt) {
      clusters.push([cur])
    } else {
      clusters[clusters.length - 1].push(cur)
    }
  }
  return clusters
}

function itemsInRange(items: PdfRowItem[], minX: number, maxX: number): PdfRowItem[] {
  return items.filter((it) => it.x >= minX && it.x <= maxX)
}

/** True when a row has two distinct horizontal columns (dual dialogue), relative to `baseX`. */
export function isDualColumnRow(rowItems: PdfRowItem[], baseX: number): boolean {
  const charItems = itemsInRange(rowItems, characterRangeMinPt(baseX), MARGIN_DUAL_CHARACTER_MAX)
  if (clusterByGap(charItems, DUAL_COLUMN_CLUSTER_GAP_PT).length >= 2) return true
  const dlgItems = itemsInRange(rowItems, dialogueRangeMinPt(baseX), MARGIN_DUAL_DIALOGUE_MAX)
  return clusterByGap(dlgItems, DUAL_COLUMN_CLUSTER_GAP_PT).length >= 2
}

export function rowToLineGroup(
  y: number,
  rowItems: PdfRowItem[],
  pageNum: number,
  itemFilter?: (items: PdfRowItem[]) => PdfRowItem[],
): ParseLineGroup {
  const filtered = itemFilter ? itemFilter(rowItems) : rowItems
  return {
    x: Math.min(...filtered.map((r) => r.x)),
    right: Math.max(...filtered.map((r) => r.x + r.w)),
    y,
    text: joinTextRunsToLine(filtered),
    pageNum,
  }
}

function leftRightPartition(
  rowItems: PdfRowItem[],
  baseX: number,
): { left: PdfRowItem[]; right: PdfRowItem[] } {
  const charItems = itemsInRange(rowItems, characterRangeMinPt(baseX), MARGIN_DUAL_CHARACTER_MAX)
  const dlgItems = itemsInRange(rowItems, dialogueRangeMinPt(baseX), MARGIN_DUAL_DIALOGUE_MAX)
  const anchorItems = charItems.length >= 2 ? charItems : dlgItems.length >= 2 ? dlgItems : rowItems
  const clusters = clusterByGap(anchorItems, DUAL_COLUMN_CLUSTER_GAP_PT)
  if (clusters.length < 2) {
    return { left: rowItems, right: [] }
  }
  const leftMaxX = Math.max(...clusters[0].map((it) => it.x))
  const rightMinX = Math.min(...clusters[1].map((it) => it.x))
  const splitX = (leftMaxX + rightMinX) / 2
  return {
    left: rowItems.filter((it) => it.x <= splitX),
    right: rowItems.filter((it) => it.x > splitX),
  }
}

/**
 * Expand dual-dialogue rows into column-first streams per continuous segment.
 * Flushes left-then-right when a single-column row breaks the segment.
 *
 * A row is only treated as dual-column once the pattern is *confirmed* by an adjacent row also
 * looking dual-column. Genuine simultaneous dialogue always spans multiple consecutive rows with
 * a stable two-column layout; a single isolated row with a ≥40pt gap is not reliable evidence on
 * its own — e.g. a "NAME (CONT'D)" cue naturally produces a gap that size once NAME is long
 * enough (Courier's fixed character width means the gap scales with name length), and a stray
 * word set unusually far right on an otherwise-ordinary line can do the same. Requiring
 * persistence across ≥2 rows rules out both false positives without weakening detection of real
 * dual dialogue.
 */
export function expandDualDialoguePageRows(
  rows: Array<[number, PdfRowItem[]]>,
  pageNum: number,
  baseX: number,
): ParseLineGroup[] {
  const out: ParseLineGroup[] = []
  let segLeft: ParseLineGroup[] = []
  let segRight: ParseLineGroup[] = []

  const flushSegment = () => {
    out.push(...segLeft, ...segRight)
    segLeft = []
    segRight = []
  }

  const dualFlags = rows.map(([, rowItems]) => isDualColumnRow(rowItems, baseX))
  const confirmedDual = dualFlags.map(
    (flag, i) => flag && (dualFlags[i - 1] === true || dualFlags[i + 1] === true),
  )

  rows.forEach(([y, rowItems], i) => {
    if (confirmedDual[i]) {
      const { left, right } = leftRightPartition(rowItems, baseX)
      if (left.length > 0) {
        const line = rowToLineGroup(y, left, pageNum)
        if (line.text.length > 0) segLeft.push(line)
      }
      if (right.length > 0) {
        const line = rowToLineGroup(y, right, pageNum)
        if (line.text.length > 0) segRight.push(line)
      }
    } else {
      flushSegment()
      const line = rowToLineGroup(y, rowItems, pageNum)
      if (line.text.length > 0) out.push(line)
    }
  })

  flushSegment()
  return out
}

export interface PaginationSkipState {
  /** Set after a `(MORE)` line; next `(CONT'D)` character is emitted as its own cue block. */
  afterMore: boolean
}

export function shouldSkipPaginationLine(
  rawText: string,
  state: PaginationSkipState,
): { skip: boolean; next: PaginationSkipState } {
  const trimmed = rawText.trim()
  if (MORE_LINE_RE.test(trimmed)) {
    return {
      skip: true,
      next: { afterMore: true },
    }
  }
  return { skip: false, next: state }
}

/** Clear the post-(MORE) flag once the continuation character cue is processed. */
export function clearAfterMore(state: PaginationSkipState): PaginationSkipState {
  if (state.afterMore) {
    return { afterMore: false }
  }
  return state
}
