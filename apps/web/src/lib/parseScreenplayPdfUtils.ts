/** Scene heading prefix including reversed INT/EXT intercuts. */
export const SCENE_HEADING_RE =
  /^(INT\.|EXT\.|INT\.?\s*\/\s*EXT\.|EXT\.?\s*\/\s*INT\.|I\/E\.?)\s+/i

export const MORE_LINE_RE = /^\(MORE\)\s*$/i
export const MORE_INLINE_RE = /\s*\(MORE\)\s*/gi
export const CONT_RE = /\(CONT['']D\)/i

/** Min horizontal gap (PDF pt) between character-column clusters on one row. */
export const DUAL_COLUMN_CLUSTER_GAP_PT = 40

export const MARGIN_CHARACTER_MIN = 230
export const MARGIN_CHARACTER_MAX = 310
export const MARGIN_DUAL_CHARACTER_MAX = 420
export const MARGIN_DIALOGUE_MIN = 155
export const MARGIN_DIALOGUE_MAX = 265
export const MARGIN_DUAL_DIALOGUE_MAX = 400

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

/** True when a row has two distinct horizontal columns (dual dialogue). */
export function isDualColumnRow(rowItems: PdfRowItem[]): boolean {
  const charItems = itemsInRange(rowItems, MARGIN_CHARACTER_MIN, MARGIN_DUAL_CHARACTER_MAX)
  if (clusterByGap(charItems, DUAL_COLUMN_CLUSTER_GAP_PT).length >= 2) return true
  const dlgItems = itemsInRange(rowItems, MARGIN_DIALOGUE_MIN, MARGIN_DUAL_DIALOGUE_MAX)
  return clusterByGap(dlgItems, DUAL_COLUMN_CLUSTER_GAP_PT).length >= 2
}

function rowToLineGroup(
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

function leftRightPartition(rowItems: PdfRowItem[]): { left: PdfRowItem[]; right: PdfRowItem[] } {
  const charItems = itemsInRange(rowItems, MARGIN_CHARACTER_MIN, MARGIN_DUAL_CHARACTER_MAX)
  const dlgItems = itemsInRange(rowItems, MARGIN_DIALOGUE_MIN, MARGIN_DUAL_DIALOGUE_MAX)
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
 */
export function expandDualDialoguePageRows(
  rows: Array<[number, PdfRowItem[]]>,
  pageNum: number,
): ParseLineGroup[] {
  const out: ParseLineGroup[] = []
  let segLeft: ParseLineGroup[] = []
  let segRight: ParseLineGroup[] = []

  const flushSegment = () => {
    out.push(...segLeft, ...segRight)
    segLeft = []
    segRight = []
  }

  for (const [y, rowItems] of rows) {
    if (isDualColumnRow(rowItems)) {
      const { left, right } = leftRightPartition(rowItems)
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
  }

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
