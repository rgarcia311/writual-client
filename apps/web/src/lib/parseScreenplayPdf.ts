import type { ScreenplayElementType } from '@/components/ScreenplayEditor/ScreenplayExtension'
import {
  classifyElementTypeRelative,
  clearAfterMore,
  expandDualDialoguePageRows,
  findBaseX,
  isContdArtifact,
  isMoreArtifact,
  isPageNumberArtifact,
  mergeScriptBlockText,
  PAGE_NUMBER_RE,
  rowToLineGroup,
  SCENE_HEADING_RE,
  shouldMergeElementTypes,
  shouldSkipContdCharacterCue,
  shouldSkipPaginationLine,
  stripPaginationMarkerText,
  type PaginationSkipState,
  type ParseLineGroup,
} from './parseScreenplayPdfUtils'
import {
  inferLayoutFromPdfMeasurements,
  median,
  type ScreenplayLayoutConfig,
  type ScreenplayPdfMeasurements,
} from './screenplayLayout'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

interface TextItem {
  str: string
  transform: number[] // [scaleX, skewX, skewY, scaleY, x, y]
  width?: number
}

interface ScriptBlockNode {
  type: 'scriptBlock'
  attrs: { elementType: ScreenplayElementType }
  content: Array<{ type: 'text'; text: string }>
}

/** Per-element geometry accumulated while classifying lines, for `inferLayoutFromPdfMeasurements`. */
interface PdfElementGeometry {
  baseXPt: number
  actionRightMaxPt: number | null
  actionLineCount: number
  dialogueLeftPts: number[]
  parentheticalLeftPts: number[]
  characterLeftPts: number[]
  dialogueRightMaxPt: number | null
  parentheticalRightMaxPt: number | null
}

const TITLE_PAGE_NOISE_RE =
  /^(written\s+by|screenplay\s+by|story\s+by|by\b|draft|revised|revision|copyright|©|\d{1,2}[\/\-]\d|wga\b|registered|contact|address|phone|email|tel\b|fax\b|based\s+on|based\s+upon|adapted)/i

const WRITTEN_BY_RE = /^(written\s+by|screenplay\s+by|story\s+by|by)\b/i

const BASED_ON_RE = /^(based\s+on|based\s+upon|adapted\s+from)\b/i

const DATE_LINE_RE =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2}(?:st|nd|rd|th)?,?\s+)?\d{4}$|^(spring|summer|fall|winter|autumn)\s+\d{4}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/i

const CONTACT_ZONE_FRACTION = 0.18

const CONTACT_LINE_RE =
  /^\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]\d{4}$|@\w+\.\w{2,}|\d{3,5}\s+\w+\s+(st\.?|street|ave\.?|avenue|blvd\.?|boulevard|rd\.?|road|dr\.?|drive|ln\.?|lane|way|pl\.?|place)\b|[A-Z]{2}\s+\d{5}|,\s*(CA|NY|TX|FL|IL|WA|GA|PA|OH|NC|MA|AZ|MI|TN|VA|NJ|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|RI|MT|DE|SD|ND|AK|VT|WY|DC)\s+\d{5}/i

function isTitlePage(lines: ParseLineGroup[]): boolean {
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

function extractTitleFromTitlePage(lines: ParseLineGroup[]): string | null {
  if (lines.length === 0) return null

  const pageWidth = Math.max(...lines.map((l) => l.x)) + 200
  const center = pageWidth / 2

  const yValues = lines.map((l) => l.y)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  const pageRange = yMax - yMin
  const contactYThreshold =
    pageRange > 0 ? yMin + pageRange * CONTACT_ZONE_FRACTION : -Infinity

  const centeredLines = lines.filter((line) => {
    const estimatedLineWidth = line.text.length * 5.5
    const lineCenter = line.x + estimatedLineWidth / 2
    return Math.abs(lineCenter - center) < 80 && line.y >= contactYThreshold
  })

  const looksAllCaps = (s: string) => s === s.toUpperCase()

  for (const line of centeredLines) {
    const text = line.text.trim()
    if (!text || text.length < 2) continue
    if (TITLE_PAGE_NOISE_RE.test(text)) continue
    if (PAGE_NUMBER_RE.test(text)) continue
    if (DATE_LINE_RE.test(text)) continue
    if (looksAllCaps(text)) return text
  }

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

export function titleFromFilename(filename: string): string | null {
  const base = filename.replace(/\.pdf$/i, '').trim()
  if (!base) return null
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function makeBlock(elementType: ScreenplayElementType, text: string): ScriptBlockNode {
  return {
    type: 'scriptBlock',
    attrs: { elementType },
    content: [{ type: 'text', text }],
  }
}

function parseTitlePageLines(lines: ParseLineGroup[]): ScriptBlockNode[] {
  const blocks: ScriptBlockNode[] = []
  let foundTitle = false

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
    if (DATE_LINE_RE.test(text)) continue

    if (line.y < contactYThreshold || CONTACT_LINE_RE.test(text)) {
      blocks.push(makeBlock('contact', text))
      continue
    }

    if (WRITTEN_BY_RE.test(text)) {
      blocks.push(makeBlock('author', text))
      continue
    }

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

    if (!TITLE_PAGE_NOISE_RE.test(text)) {
      blocks.push(makeBlock('author', text))
    }
  }

  return blocks
}

function filterLayoutArtifacts(lines: ParseLineGroup[], pageHeightPt: number): ParseLineGroup[] {
  const lastIndex = lines.length - 1
  return lines.filter((line, idx) => {
    if (isPageNumberArtifact(line, pageHeightPt)) return false
    if (isMoreArtifact(line, pageHeightPt, idx === lastIndex)) return false
    if (isContdArtifact(line, pageHeightPt)) return false
    if (PAGE_NUMBER_RE.test(line.text.trim())) return false
    if (/^page\s+\d+/i.test(line.text.trim())) return false
    return true
  })
}

function linesToScriptBlocks(
  allLines: ParseLineGroup[],
  baseX: number,
): {
  blocks: ScriptBlockNode[]
  geometry: PdfElementGeometry
} {
  const blocks: ScriptBlockNode[] = []
  let paginationState: PaginationSkipState = { afterMore: false }
  let lastLineY: number | null = null
  let lastPageNum: number | null = null

  let actionRightMaxPt: number | null = null
  let actionLineCount = 0
  const dialogueLeftPts: number[] = []
  const parentheticalLeftPts: number[] = []
  const characterLeftPts: number[] = []
  let dialogueRightMaxPt: number | null = null
  let parentheticalRightMaxPt: number | null = null

  for (const line of allLines) {
    const rawText = line.text.trim()
    if (rawText.length === 0) {
      lastLineY = line.y
      lastPageNum = line.pageNum
      continue
    }

    const moreSkip = shouldSkipPaginationLine(rawText, paginationState)
    if (moreSkip.skip) {
      paginationState = moreSkip.next
      lastLineY = line.y
      lastPageNum = line.pageNum
      continue
    }

    const text = stripPaginationMarkerText(rawText)
    if (text.length === 0) {
      lastLineY = line.y
      lastPageNum = line.pageNum
      continue
    }

    const elementType = classifyElementTypeRelative(line.x, text, baseX)
    const lastBlock = blocks[blocks.length - 1]
    const lastBlockType = lastBlock?.attrs.elementType ?? null

    if (shouldSkipContdCharacterCue(elementType, rawText, lastBlockType)) {
      paginationState = clearAfterMore(paginationState)
      lastLineY = line.y
      lastPageNum = line.pageNum
      continue
    }

    // Accumulate per-element geometry (post pagination-artifact/CONT'D filtering) so imported
    // screenplays can infer their real margins/indents instead of always using the WGA default.
    if (elementType === 'action' || elementType === 'slugline') {
      actionLineCount++
      if (Number.isFinite(line.right)) {
        actionRightMaxPt = actionRightMaxPt == null ? line.right : Math.max(actionRightMaxPt, line.right)
      }
    } else if (elementType === 'dialogue') {
      dialogueLeftPts.push(line.x)
      if (Number.isFinite(line.right)) {
        dialogueRightMaxPt = dialogueRightMaxPt == null ? line.right : Math.max(dialogueRightMaxPt, line.right)
      }
    } else if (elementType === 'parenthetical') {
      parentheticalLeftPts.push(line.x)
      if (Number.isFinite(line.right)) {
        parentheticalRightMaxPt =
          parentheticalRightMaxPt == null ? line.right : Math.max(parentheticalRightMaxPt, line.right)
      }
    } else if (elementType === 'character') {
      characterLeftPts.push(line.x)
    }

    const gap =
      lastLineY !== null && lastPageNum === line.pageNum
        ? Math.abs(lastLineY - line.y)
        : 0
    const isNewParagraph = gap > 18

    if (
      !isNewParagraph &&
      shouldMergeElementTypes(elementType, lastBlockType) &&
      lastBlock
    ) {
      const existing = lastBlock.content[0]?.text ?? ''
      lastBlock.content = [{ type: 'text', text: mergeScriptBlockText(existing, text) }]
    } else {
      blocks.push(makeBlock(elementType, text))
    }

    if (elementType === 'character') {
      paginationState = clearAfterMore(paginationState)
    }

    lastLineY = line.y
    lastPageNum = line.pageNum
  }

  return {
    blocks,
    geometry: {
      baseXPt: baseX,
      actionRightMaxPt,
      actionLineCount,
      dialogueLeftPts,
      parentheticalLeftPts,
      characterLeftPts,
      dialogueRightMaxPt,
      parentheticalRightMaxPt,
    },
  }
}

export interface ParseScreenplayPdfResult {
  doc: Record<string, unknown>
  pageCount: number
  title: string | null
  layout?: ScreenplayLayoutConfig
}

/**
 * Safari never implemented `ReadableStream.prototype[Symbol.asyncIterator]` (unlike Chrome/
 * Firefox), but pdfjs-dist's `getTextContent()` uses `for await...of` over a native
 * `ReadableStream` unconditionally. Without this, every PDF import throws
 * "undefined is not a function (near '...value of readableStream...')" in Safari only.
 */
function polyfillReadableStreamAsyncIterator(): void {
  const proto = ReadableStream.prototype as ReadableStream & { [Symbol.asyncIterator]?: unknown }
  if (typeof proto[Symbol.asyncIterator] === 'function') return

  proto[Symbol.asyncIterator] = function (this: ReadableStream) {
    const reader = this.getReader()
    return {
      next: () => reader.read(),
      return: (value: unknown) => {
        reader.releaseLock()
        return Promise.resolve({ done: true as const, value })
      },
      [Symbol.asyncIterator](): AsyncIterator<unknown> {
        return this as unknown as AsyncIterator<unknown>
      },
    }
  } as () => AsyncIterableIterator<unknown>
}

export async function parseScreenplayPdfFromBuffer(
  data: ArrayBuffer,
  options?: { filename?: string },
): Promise<ParseScreenplayPdfResult> {
  polyfillReadableStreamAsyncIterator()
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const pdf = await getDocument({ data }).promise
  const pageCount = pdf.numPages

  interface PageRowData {
    pageNum: number
    pageHeightPt: number
    sortedRows: Array<[number, Array<{ x: number; str: string; w: number }>]>
  }

  const titlePageBlocks: ScriptBlockNode[] = []
  let skippedTitlePage = false
  let extractedTitle: string | null = null
  // Captures the last page's viewport — pages are assumed uniform size, matching how the layout
  // inference is applied (one config for the whole imported document).
  let capturedPageWidthPt = 612
  let capturedPageHeightPt = 792

  // Pass 1: extract every page's raw text rows once (a single pdf.js fetch per page). Row
  // grouping alone doesn't need a calibrated baseX, so this happens before calibration.
  const pageRowData: PageRowData[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum)
    let pageHeightPt = 792
    try {
      const viewport = page.getViewport({ scale: 1 })
      pageHeightPt = viewport.height
      capturedPageWidthPt = viewport.width
      capturedPageHeightPt = viewport.height
    } catch {
      /* use Letter default */
    }

    const textContent = await page.getTextContent()
    const items = (textContent.items as TextItem[]).filter((item) => item.str.trim().length > 0)
    if (items.length === 0) {
      pageRowData.push({ pageNum, pageHeightPt, sortedRows: [] })
      continue
    }

    const lineMap = new Map<number, Array<{ x: number; str: string; w: number }>>()

    for (const item of items) {
      const x = Math.round(item.transform[4])
      const y = Math.round(item.transform[5])
      const w = typeof item.width === 'number' && Number.isFinite(item.width) ? item.width : 0

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
        existing.push({ x, str: item.str, w })
      } else {
        lineMap.set(key, [{ x, str: item.str, w }])
      }
    }

    const sortedRows = Array.from(lineMap.entries()).sort(([yA], [yB]) => yB - yA)
    pageRowData.push({ pageNum, pageHeightPt, sortedRows })
  }

  // Pass 2: calibrate the document's baseX from un-split rows (each row treated as a single
  // line, no dual-dialogue awareness) *before* dual-column expansion — expansion itself now needs
  // a correctly-calibrated baseX to compute its own column margins (see `isDualColumnRow`), so
  // calibration can't wait until after expansion the way it used to.
  const roughLinesForCalibration: ParseLineGroup[] = []

  for (const { pageNum, sortedRows } of pageRowData) {
    const roughLines = sortedRows
      .map(([y, rowItems]) => rowToLineGroup(y, rowItems, pageNum))
      .filter((line) => line.text.length > 0)

    if (pageNum === 1 && !skippedTitlePage && isTitlePage(roughLines)) {
      extractedTitle = extractTitleFromTitlePage(roughLines)
      titlePageBlocks.push(...parseTitlePageLines(roughLines))
      skippedTitlePage = true
      continue
    }

    roughLinesForCalibration.push(...roughLines)
  }

  const baseX = findBaseX(roughLinesForCalibration)

  // Pass 3: now that baseX is known, expand dual-dialogue rows and strip pagination artifacts.
  const allLines: ParseLineGroup[] = []

  for (const { pageNum, pageHeightPt, sortedRows } of pageRowData) {
    if (pageNum === 1 && skippedTitlePage) continue

    const pageLines = expandDualDialoguePageRows(sortedRows, pageNum, baseX).filter(
      (line) => line.text.length > 0,
    )
    allLines.push(...filterLayoutArtifacts(pageLines, pageHeightPt))
  }

  if (allLines.length === 0 && titlePageBlocks.length === 0) {
    throw new Error(
      'This PDF appears to be a scanned image or contains no extractable text. Please use a PDF with selectable text.',
    )
  }

  const { blocks, geometry } = linesToScriptBlocks(allLines, baseX)
  const allBlocks = [...titlePageBlocks, ...blocks]
  const screenplayPageTotal = Math.max(1, pageCount - (skippedTitlePage ? 1 : 0))
  const filename = options?.filename ?? 'screenplay.pdf'
  const title = extractedTitle ?? titleFromFilename(filename)

  let layout: ScreenplayLayoutConfig | undefined
  try {
    const measurements: ScreenplayPdfMeasurements = {
      pageWidthPt: capturedPageWidthPt,
      pageHeightPt: capturedPageHeightPt,
      baseXPt: geometry.baseXPt,
      actionRightMaxPt: geometry.actionRightMaxPt,
      actionLineCount: geometry.actionLineCount,
      dialogueLeftPt: median(geometry.dialogueLeftPts),
      parentheticalLeftPt: median(geometry.parentheticalLeftPts),
      characterLeftPt: median(geometry.characterLeftPts),
      dialogueRightMaxPt: geometry.dialogueRightMaxPt,
      parentheticalRightMaxPt: geometry.parentheticalRightMaxPt,
    }
    layout = inferLayoutFromPdfMeasurements(measurements) ?? undefined
  } catch (err) {
    console.warn('[parseScreenplayPdf] layout inference failed; using default layout.', err)
    layout = undefined
  }

  return {
    doc: { type: 'doc', content: allBlocks },
    pageCount: screenplayPageTotal,
    title,
    ...(layout ? { layout } : {}),
  }
}

export async function parseScreenplayPdf(file: File): Promise<ParseScreenplayPdfResult> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Please select a PDF file.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 20MB limit.`,
    )
  }

  return parseScreenplayPdfFromBuffer(await file.arrayBuffer(), { filename: file.name })
}
