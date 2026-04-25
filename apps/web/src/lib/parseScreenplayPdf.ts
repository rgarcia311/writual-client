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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '')
  return letters.length > 0 && letters === letters.toUpperCase()
}

const TITLE_PAGE_NOISE_RE =
  /^(written\s+by|by\b|draft|revised|revision|copyright|©|\d{1,2}[\/\-]\d|wga\b|registered|contact|address|phone|email|tel\b|fax\b|based\s+on|adapted)/i

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

  const centeredLines = lines.filter((line) => {
    const estimatedLineWidth = line.text.length * 5.5
    const lineCenter = line.x + estimatedLineWidth / 2
    return Math.abs(lineCenter - center) < 80
  })

  for (const line of centeredLines) {
    const text = line.text.trim()
    if (!text || text.length < 2) continue
    if (TITLE_PAGE_NOISE_RE.test(text)) continue
    if (PAGE_NUMBER_RE.test(text)) continue
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
    const lineMap = new Map<number, { x: number; parts: string[] }>()

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
        existing.parts.push(item.str)
        existing.x = Math.min(existing.x, x)
      } else {
        lineMap.set(key, { x, parts: [item.str] })
      }
    }

    const pageLines: LineGroup[] = Array.from(lineMap.entries())
      .sort(([yA], [yB]) => yB - yA) // descending Y = top-to-bottom
      .map(([y, { x, parts }]) => ({
        x,
        y,
        text: parts.join('').trim(),
      }))
      .filter((line) => line.text.length > 0)

    if (pageNum === 1 && !skippedTitlePage && isTitlePage(pageLines)) {
      extractedTitle = extractTitleFromTitlePage(pageLines)
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

  for (const line of allLines) {
    const elementType = classifyLine(line, prevType)
    const text = line.text.trim()

    if (text.length === 0) {
      prevType = elementType
      continue
    }

    const lastBlock = blocks[blocks.length - 1]

    const shouldMerge =
      lastBlock &&
      lastBlock.attrs.elementType === elementType &&
      elementType !== 'slugline' &&
      elementType !== 'character' &&
      elementType !== 'transition'

    if (shouldMerge) {
      const existing = lastBlock.content[0]?.text ?? ''
      const separator = elementType === 'action' ? '\n' : ' '
      lastBlock.content = [{ type: 'text', text: existing + separator + text }]
    } else {
      blocks.push({
        type: 'scriptBlock',
        attrs: { elementType },
        content: [{ type: 'text', text }],
      })
    }

    prevType = elementType
  }

  const title = extractedTitle ?? titleFromFilename(file.name)

  return {
    doc: { type: 'doc', content: blocks },
    pageCount,
    title,
  }
}
