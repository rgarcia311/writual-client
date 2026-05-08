import type { ScreenplayElementType } from '@/components/ScreenplayEditor/ScreenplayExtension'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
interface TextItem {
  str: string
  transform: number[] // [scaleX, skewX, skewY, scaleY, x, y]
}

interface LineGroup {
  x: number
  y: number
  text: string
  pageNum: number
}

interface ScriptBlockNode {
  type: 'scriptBlock'
  attrs: { elementType: ScreenplayElementType }
  content: Array<{ type: 'text'; text: string }>
}

// ─── Scene heading patterns ──────────────────────────────────────────────────

const SCENE_HEADING_RE =
  /^(INT\.|EXT\.|INT\.?\s*\/\s*EXT\.|I\/E\.?)\s+/i

const TRANSITION_RE =
  /^(FADE\s+(IN|OUT|TO\s+BLACK)|CUT\s+TO|SMASH\s+CUT\s+TO|MATCH\s+CUT\s+TO|DISSOLVE\s+TO|WIPE\s+TO|JUMP\s+CUT\s+TO|IRIS\s+IN|IRIS\s+OUT|INTERCUT|FADE\s+TO):?\s*\.?$/i

const TRANSITION_SUFFIX_RE = /\s+TO:$/

const PAGE_NUMBER_RE = /^\d{1,4}\.?$/

const CONT_RE = /\(CONT['']D\)/i

// ─── Margin thresholds (in PDF points, 72pt = 1 inch) ──────────────────────

const MARGIN_TRANSITION_MIN = 380
const MARGIN_CHARACTER_MIN = 230
const MARGIN_CHARACTER_MAX = 310
const MARGIN_PAREN_MIN = 185
const MARGIN_PAREN_MAX = 260
const MARGIN_DIALOGUE_MIN = 155
const MARGIN_DIALOGUE_MAX = 265
const MARGIN_ACTION_MAX = 160

/**
 * Max vertical distance (PDF user space, Y bottom-up) between consecutive action
 * baselines to treat them as one wrapped paragraph. Above this → new script block
 * so editor block padding matches spec double-spacing (~24pt) vs single line (~12pt).
 */
const ACTION_LINE_MERGE_MAX_DELTA_Y = 18

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Text runs on one PDF line are separate items; joining with `''` smashes words ("CA" + "Written").
 * Sort left-to-right, join with spaces, normalize whitespace.
 */
function joinTextRunsToLine(
  rowItems: Array<{ x: number; str: string }>,
): string {
  if (rowItems.length === 0) return ''
  const sorted = [...rowItems].sort((a, b) => a.x - b.x)
  return sorted
    .map((it) => it.str)
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '')
  return letters.length > 0 && letters === letters.toUpperCase()
}

const TITLE_PAGE_NOISE_RE =
  /^(written\s+by|screenplay\s+by|story\s+by|by\b|draft|revised|revision|copyright|©|\d{1,2}[\/\-]\d|wga\b|registered|contact|address|phone|email|tel\b|fax\b|based\s+on|based\s+upon|adapted)/i

const WRITTEN_BY_RE = /^(written\s+by|screenplay\s+by|story\s+by|by)\b/i

const BASED_ON_RE = /^(based\s+on|based\s+upon|adapted\s+from)\b/i

/**
 * Matches common date formats found on title pages.
 * Intentionally excludes bare 4-digit years to avoid swallowing numerical titles
 * like "1917", "1984", or "2001".
 */
const DATE_LINE_RE =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2}(?:st|nd|rd|th)?,?\s+)?\d{4}$|^(spring|summer|fall|winter|autumn)\s+\d{4}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/i

/** Fraction of the page's Y range (bottom-up) that is treated as the contact/date corner zone. */
const CONTACT_ZONE_FRACTION = 0.18

/**
 * Matches common contact-info patterns: phone numbers, postal addresses
 * (street number + street type), email addresses, and "City, ST ZIP" strings.
 */
const CONTACT_LINE_RE =
  /^\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]\d{4}$|@\w+\.\w{2,}|\d{3,5}\s+\w+\s+(st\.?|street|ave\.?|avenue|blvd\.?|boulevard|rd\.?|road|dr\.?|drive|ln\.?|lane|way|pl\.?|place)\b|[A-Z]{2}\s+\d{5}|,\s*(CA|NY|TX|FL|IL|WA|GA|PA|OH|NC|MA|AZ|MI|TN|VA|NJ|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|RI|MT|DE|SD|ND|AK|VT|WY|DC)\s+\d{5}/i

function isTitlePage(lines: LineGroup[]): boolean {
  if (lines.length === 0) return true

  const pageWidth = Math.max(...lines.map((l) => l.x)) + 200
  const center = pageWidth / 2
  let centeredCount = 0

  for (const line of lines) {
    const estimatedLineWidth = line.text.length * 5.5
    const lineCenter = line.x + estimatedLineWidth / 2
    if (Math.abs(lineCenter - center) < 80) centeredCount++
  }

  const centeredRatio = centeredCount / lines.length
  const hasSceneHeading = lines.some((l) => SCENE_HEADING_RE.test(l.text.trim()))

  return centeredRatio > 0.4 && !hasSceneHeading
}

function extractTitleFromTitlePage(lines: LineGroup[]): string | null {
  if (lines.length === 0) return null

  const pageWidth = Math.max(...lines.map((l) => l.x)) + 200
  const center = pageWidth / 2

  const yValues = lines.map((l) => l.y)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  const pageRange = yMax - yMin
  const contactYThreshold =
    pageRange > 0 ? yMin + pageRange * CONTACT_ZONE_FRACTION : -Infinity

  // Centered lines that are not in the bottom contact corner
  const centeredLines = lines.filter((line) => {
    const estimatedLineWidth = line.text.length * 5.5
    const lineCenter = line.x + estimatedLineWidth / 2
    return Math.abs(lineCenter - center) < 80 && line.y >= contactYThreshold
  })

  // s === s.toUpperCase() treats numeric titles (e.g. "1917") as "all caps"
  const looksAllCaps = (s: string) => s === s.toUpperCase()

  // Pass 1: prefer an ALL CAPS centered line (standard title format)
  for (const line of centeredLines) {
    const text = line.text.trim()
    if (!text || text.length < 2) continue
    if (TITLE_PAGE_NOISE_RE.test(text)) continue
    if (PAGE_NUMBER_RE.test(text)) continue
    if (DATE_LINE_RE.test(text)) continue
    if (looksAllCaps(text)) return text
  }

  // Pass 2: fallback — first non-noise, non-date centered line
  for (const line of centeredLines) {
    const text = line.text.trim()
    if (!text || text.length < 2) continue
    if (TITLE_PAGE_NOISE_RE.test(text)) continue
    if (PAGE_NUMBER_RE.test(text)) continue
    if (DATE_LINE_RE.test(text)) continue
    return text
  }

  return null
}

function titleFromFilename(filename: string): string | null {
  const base = filename.replace(/\.pdf$/i, '').trim()
  if (!base) return null
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function classifyLine(
  line: LineGroup,
  prevType: ScreenplayElementType | null,
): ScreenplayElementType {
  const text = line.text.trim()
  if (!text) return 'action'

  const x = line.x

  if (SCENE_HEADING_RE.test(text)) return 'slugline'

  if (
    x >= MARGIN_TRANSITION_MIN ||
    TRANSITION_RE.test(text) ||
    (isAllCaps(text) && TRANSITION_SUFFIX_RE.test(text))
  ) {
    return 'transition'
  }

  if (
    x >= MARGIN_CHARACTER_MIN &&
    x <= MARGIN_CHARACTER_MAX &&
    isAllCaps(text.replace(CONT_RE, '').replace(/\(.*?\)/g, '').trim())
  ) {
    return 'character'
  }

  if (
    x >= MARGIN_PAREN_MIN &&
    x <= MARGIN_PAREN_MAX &&
    text.startsWith('(')
  ) {
    return 'parenthetical'
  }

  if (
    x >= MARGIN_DIALOGUE_MIN &&
    x <= MARGIN_DIALOGUE_MAX &&
    (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue')
  ) {
    return 'dialogue'
  }

  if (x <= MARGIN_ACTION_MAX) {
    return 'action'
  }

  if (prevType === 'dialogue' || prevType === 'character' || prevType === 'parenthetical') {
    return 'dialogue'
  }

  return 'action'
}

// ─── Title page parser ────────────────────────────────────────────────────────

function makeBlock(elementType: ScreenplayElementType, text: string): ScriptBlockNode {
  return {
    type: 'scriptBlock',
    attrs: { elementType },
    content: [{ type: 'text', text }],
  }
}

/**
 * Classify lines from a detected title page into title / author / contact
 * blocks. Lines are already sorted top-to-bottom by the page parser.
 *
 * Strategy:
 *  - Date lines (month/season patterns) → skipped (spec scripts omit dates)
 *  - Bottom-corner lines (Y < contactYThreshold) or contact patterns → contact
 *  - Lines matching "written by" / "screenplay by" / "story by" / "by" → author
 *  - Lines matching "based on…" / "adapted from…" → author (preserved credits)
 *  - First non-noise, non-page-number line → title
 *  - Subsequent non-contact, non-noise lines → author
 */
function parseTitlePageLines(lines: LineGroup[]): ScriptBlockNode[] {
  const blocks: ScriptBlockNode[] = []
  let foundTitle = false

  // PDF Y-axis is bottom-up; compute zone thresholds from the text range on this page.
  const yValues = lines.map((l) => l.y)
  const yMin = yValues.length > 0 ? Math.min(...yValues) : 0
  const yMax = yValues.length > 0 ? Math.max(...yValues) : 0
  const pageRange = yMax - yMin
  const contactYThreshold =
    pageRange > 0 ? yMin + pageRange * CONTACT_ZONE_FRACTION : -Infinity

  for (const line of lines) {
    const text = line.text.trim()
    if (!text || text.length < 2) continue
    if (PAGE_NUMBER_RE.test(text)) continue

    // Skip date lines — spec scripts should omit dates to avoid dating the material
    if (DATE_LINE_RE.test(text)) continue

    // Bottom-corner lines → contact (covers name-only lines with no email/phone pattern)
    if (line.y < contactYThreshold || CONTACT_LINE_RE.test(text)) {
      blocks.push(makeBlock('contact', text))
      continue
    }

    if (WRITTEN_BY_RE.test(text)) {
      blocks.push(makeBlock('author', text))
      continue
    }

    // "Based on…" is a valid credits line; preserve it as author before noise guard fires
    if (BASED_ON_RE.test(text)) {
      blocks.push(makeBlock('author', text))
      continue
    }

    if (!foundTitle) {
      if (TITLE_PAGE_NOISE_RE.test(text)) continue
      blocks.push(makeBlock('title', text))
      foundTitle = true
      continue
    }

    // After the title: skip noise; remaining lines are author names
    if (!TITLE_PAGE_NOISE_RE.test(text)) {
      blocks.push(makeBlock('author', text))
    }
  }

  return blocks
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export async function parseScreenplayPdf(file: File): Promise<{
  doc: Record<string, unknown>
  pageCount: number
  title: string | null
}> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Please select a PDF file.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 20MB limit.`,
    )
  }

  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const pageCount = pdf.numPages

  const allLines: LineGroup[] = []
  const titlePageBlocks: ScriptBlockNode[] = []
  let skippedTitlePage = false
  let extractedTitle: string | null = null

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    const items = (textContent.items as TextItem[]).filter(
      (item) => item.str.trim().length > 0,
    )

    if (items.length === 0) continue

    // Stipulation: PDF Y-axis is bottom-up, sort descending by Y for top-to-bottom
    const lineMap = new Map<number, Array<{ x: number; str: string }>>()

    for (const item of items) {
      const x = Math.round(item.transform[4])
      const y = Math.round(item.transform[5])

      let matchedY: number | null = null
      for (const existingY of Array.from(lineMap.keys())) {
        if (Math.abs(existingY - y) <= 3) {
          matchedY = existingY
          break
        }
      }

      const key = matchedY ?? y
      const existing = lineMap.get(key)
      if (existing) {
        existing.push({ x, str: item.str })
      } else {
        lineMap.set(key, [{ x, str: item.str }])
      }
    }

    const pageLines: LineGroup[] = Array.from(lineMap.entries())
      .sort(([yA], [yB]) => yB - yA) // descending Y = top-to-bottom
      .map(([y, rowItems]) => ({
        x: Math.min(...rowItems.map((r) => r.x)),
        y,
        text: joinTextRunsToLine(rowItems),
        pageNum,
      }))
      .filter((line) => line.text.length > 0)

    if (pageNum === 1 && !skippedTitlePage && isTitlePage(pageLines)) {
      extractedTitle = extractTitleFromTitlePage(pageLines)
      titlePageBlocks.push(...parseTitlePageLines(pageLines))
      skippedTitlePage = true
      continue
    }

    const filtered = pageLines.filter((line) => {
      if (PAGE_NUMBER_RE.test(line.text.trim())) return false
      if (/^page\s+\d+/i.test(line.text.trim())) return false
      return true
    })

    allLines.push(...filtered)
  }

  if (allLines.length === 0) {
    throw new Error(
      'This PDF appears to be a scanned image or contains no extractable text. Please use a PDF with selectable text.',
    )
  }

  // Classify each line and merge consecutive same-type lines into blocks
  const blocks: ScriptBlockNode[] = []
  let prevType: ScreenplayElementType | null = null
  let prevNonEmptyLine: LineGroup | null = null
  // #region agent log
  const dbgActionMergeGaps: Array<{
    deltaY: number | null
    crossPage: boolean
    afterType: ScreenplayElementType
  }> = []
  const dbgTypeTransitions: Array<{ from: ScreenplayElementType | null; to: ScreenplayElementType; x: number; preview: string }> = []
  let dbgLargeGapParagraphSplits = 0
  let dbgCrossPageActionSplits = 0
  // #endregion

  for (const line of allLines) {
    const elementType = classifyLine(line, prevType)
    const text = line.text.trim()

    if (text.length === 0) {
      prevType = elementType
      continue
    }

    const lastBlock = blocks[blocks.length - 1]

    let shouldMerge = Boolean(
      lastBlock &&
        lastBlock.attrs.elementType === elementType &&
        elementType !== 'slugline' &&
        elementType !== 'character' &&
        elementType !== 'transition',
    )

    if (
      shouldMerge &&
      elementType === 'action' &&
      prevNonEmptyLine
    ) {
      if (prevNonEmptyLine.pageNum !== line.pageNum) {
        shouldMerge = false
        // #region agent log
        dbgCrossPageActionSplits++
        // #endregion
      } else {
        const deltaY = prevNonEmptyLine.y - line.y
        if (deltaY > ACTION_LINE_MERGE_MAX_DELTA_Y) {
          shouldMerge = false
          // #region agent log
          dbgLargeGapParagraphSplits++
          // #endregion
        }
      }
    }

    if (shouldMerge && lastBlock) {
      // #region agent log
      if (elementType === 'action' && prevNonEmptyLine) {
        const samePage = prevNonEmptyLine.pageNum === line.pageNum
        const deltaY =
          samePage ? prevNonEmptyLine.y - line.y : null
        dbgActionMergeGaps.push({
          deltaY,
          crossPage: !samePage,
          afterType: elementType,
        })
      }
      // #endregion
      const existing = lastBlock.content[0]?.text ?? ''
      const separator = elementType === 'action' ? '\n' : ' '
      lastBlock.content = [{ type: 'text', text: existing + separator + text }]
    } else {
      // #region agent log
      if (prevType !== null && prevType !== elementType) {
        dbgTypeTransitions.push({
          from: prevType,
          to: elementType,
          x: line.x,
          preview: text.slice(0, 80),
        })
      }
      // #endregion
      blocks.push({
        type: 'scriptBlock',
        attrs: { elementType },
        content: [{ type: 'text', text }],
      })
    }

    prevType = elementType
    prevNonEmptyLine = line
  }

  // #region agent log
  const dbgActionBlocks = blocks.filter((b) => b.attrs.elementType === 'action')
  const dbgNewlineCounts = dbgActionBlocks.map((b) => {
    const t = b.content[0]?.text ?? ''
    return (t.match(/\n/g) ?? []).length
  })
  const dbgLargeGaps = dbgActionMergeGaps.filter(
    (g) => g.deltaY != null && g.deltaY > 14,
  )
  fetch('http://127.0.0.1:7264/ingest/6603c130-d193-4aa3-9499-e934ff9eb1b2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '293bef',
    },
    body: JSON.stringify({
      sessionId: '293bef',
      runId: 'post-fix',
      hypothesisId: 'H1-H5',
      location: 'parseScreenplayPdf.ts:post-classify',
      message: 'PDF action merge vs editor block spacing',
      data: {
        actionMergeCount: dbgActionMergeGaps.length,
        actionBlockCount: dbgActionBlocks.length,
        actionBlocksWithInternalNewline: dbgNewlineCounts.filter((n) => n > 0).length,
        maxNewlinesInOneActionBlock: dbgNewlineCounts.length ? Math.max(...dbgNewlineCounts) : 0,
        largePdfYGapMerges_count14: dbgLargeGaps.length,
        largePdfYGapMerges_sample: dbgLargeGaps.slice(0, 8).map((g) => g.deltaY),
        crossPageActionMerges: dbgActionMergeGaps.filter((g) => g.crossPage).length,
        largeGapParagraphSplits: dbgLargeGapParagraphSplits,
        crossPageActionSplits: dbgCrossPageActionSplits,
        typeTransitionSample: dbgTypeTransitions.slice(0, 12),
        lineGroupCount: allLines.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  const allBlocks = [...titlePageBlocks, ...blocks]

  /** Body-page count excludes a detected cover PDF page; never below 1 (title-only file). */
  const screenplayPageTotal = Math.max(1, pageCount - (skippedTitlePage ? 1 : 0))
  const title = extractedTitle ?? titleFromFilename(file.name)

  return {
    doc: { type: 'doc', content: allBlocks },
    pageCount: screenplayPageTotal,
    title,
  }
}
