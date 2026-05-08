'use client'

import type { Editor } from '@tiptap/core'
import { jsPDF } from 'jspdf'

import type { ScreenplayElementType } from './ScreenplayExtension'

/** 12pt line in inches (72pt = 1in) */
const LINE_HEIGHT_IN = 12 / 72

const TOP_CONTENT_IN = 1.0
/** 11" page, 1" bottom margin → last line must end by 10" */
const BOTTOM_CONTENT_IN = 10.0

/** WGA layout: x and max width in inches (8.5" letter). Transition: right edge 7.5" (5.5" + 2.0" wide). */
const LAYOUT: Record<
  ScreenplayElementType,
  { x: number; w: number; rightEdge?: number; oneLine?: boolean; upper?: boolean }
> = {
  title: { x: 1.5, w: 6.0 },
  author: { x: 1.5, w: 6.0 },
  contact: { x: 1.5, w: 6.0 },
  action: { x: 1.5, w: 6.0 },
  slugline: { x: 1.5, w: 6.0, upper: true },
  character: { x: 3.7, w: 4.0, oneLine: true },
  parenthetical: { x: 3.1, w: 2.0 },
  dialogue: { x: 2.5, w: 3.5 },
  transition: { x: 5.5, w: 2.0, rightEdge: 7.5 },
}

function normalizeType(raw: unknown): ScreenplayElementType {
  const s = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (
    s === 'slugline' ||
    s === 'action' ||
    s === 'character' ||
    s === 'parenthetical' ||
    s === 'dialogue' ||
    s === 'transition' ||
    s === 'title' ||
    s === 'author' ||
    s === 'contact'
  ) {
    return s
  }
  return 'action'
}

/**
 * Inter-block vertical gaps in inches (Letter, 8.5×11). One blank line = 1/6".
 * Scene heading: table allows 1–2 blank lines (1/6"–1/3") before the heading;
 * we use 1/3" (two blanks) after anything with a trailing line except Character/Parenthetical.
 */
const ONE_LINE_IN = LINE_HEIGHT_IN // 1/6"
const TWO_LINES_IN = (2 * 12) / 72 // 1/3"

function sluglineGapInches(prev: ScreenplayElementType): number {
  if (prev === 'character' || prev === 'parenthetical') {
    return ONE_LINE_IN
  }
  return TWO_LINES_IN
}

function interBlockGapInches(
  prev: ScreenplayElementType | null,
  next: ScreenplayElementType,
): number {
  if (
    prev != null &&
    ((prev === 'character' && (next === 'parenthetical' || next === 'dialogue')) ||
      (prev === 'parenthetical' && next === 'dialogue'))
  ) {
    return 0
  }
  if (prev != null && next === 'slugline') {
    return sluglineGapInches(prev)
  }
  return LINE_HEIGHT_IN
}

const TITLE_PAGE_TYPES_PDF = new Set<ScreenplayElementType>(['title', 'author', 'contact'])

/**
 * Build a Letter-size PDF with WGA inch-based layout and line-level pagination.
 * Title-page blocks (title / author / contact) at the start of the document are
 * rendered on a dedicated unnumbered page; the screenplay body begins on page 1.
 */
export async function generateScreenplayPDF(editor: Editor): Promise<Blob> {
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  doc.setFont('courier', 'normal')
  doc.setFontSize(12)

  // ── Partition blocks into title-page and body ────────────────────────────
  const titleBlocks: { type: ScreenplayElementType; text: string }[] = []
  const bodyBlocks: { type: ScreenplayElementType; text: string }[] = []
  let inTitlePage = true

  editor.state.doc.forEach((node) => {
    if (node.type.name !== 'scriptBlock') return
    const type = normalizeType(node.attrs.elementType)
    let text = node.textContent ?? ''
    if (type === 'slugline') text = text.toUpperCase()

    if (inTitlePage && TITLE_PAGE_TYPES_PDF.has(type)) {
      titleBlocks.push({ type, text })
    } else {
      inTitlePage = false
      bodyBlocks.push({ type, text })
    }
  })

  // ── Render title page ────────────────────────────────────────────────────
  if (titleBlocks.length > 0) {
    const titleAuthorLines: { type: ScreenplayElementType; text: string }[] = []
    const contactLines: { type: ScreenplayElementType; text: string }[] = []
    for (const b of titleBlocks) {
      if (b.type === 'contact') {
        contactLines.push(b)
      } else {
        titleAuthorLines.push(b)
      }
    }

    // Title + author group: centered, starting ~1/3 down the page.
    // Each block is separated by one blank line (LINE_HEIGHT_IN) to mirror the
    // CSS padding-bottom:12pt applied to title/author blocks in the editor.
    let tay = 3.5
    let isFirstTitleBlock = true
    for (const { text } of titleAuthorLines) {
      if (!isFirstTitleBlock) {
        tay += LINE_HEIGHT_IN // one blank line between successive title-area blocks
      }
      isFirstTitleBlock = false
      const lines = doc.splitTextToSize(text || ' ', 5.0)
      for (const line of lines) {
        doc.text(line, 4.25, tay, { align: 'center', maxWidth: 5.0 })
        tay += LINE_HEIGHT_IN
      }
    }

    // Contact info: bottom-left. Use the full LAYOUT width so that a single-line
    // address (one contact block = one PDF line) is never word-wrapped.
    const contactSpec = LAYOUT['contact']
    let cy = 9.0
    for (const { text } of contactLines) {
      const lines = doc.splitTextToSize(text || ' ', contactSpec.w)
      for (const line of lines) {
        doc.text(line, contactSpec.x, cy)
        cy += LINE_HEIGHT_IN
      }
    }

    if (bodyBlocks.length > 0) {
      doc.addPage()
      doc.setFont('courier', 'normal')
      doc.setFontSize(12)
    }
  }

  // ── Render screenplay body ────────────────────────────────────────────────
  const blocksToRender = bodyBlocks

  let y = TOP_CONTENT_IN
  let pageNum = 1

  if (titleBlocks.length > 0 && blocksToRender.length > 0) {
    doc.text(`${pageNum}.`, 7.5, 0.5, { align: 'right' })
  }

  const newPage = () => {
    doc.addPage()
    pageNum += 1
    doc.setFont('courier', 'normal')
    doc.setFontSize(12)
    doc.text(`${pageNum}.`, 7.5, 0.5, { align: 'right' })
    y = TOP_CONTENT_IN
  }

  const ensureLineFits = () => {
    if (y + LINE_HEIGHT_IN > BOTTOM_CONTENT_IN) {
      newPage()
    }
  }

  let prevType: ScreenplayElementType | null = null

  for (let i = 0; i < blocksToRender.length; i++) {
    const { type, text } = blocksToRender[i]
    if (i > 0 && prevType != null) {
      const gap = interBlockGapInches(prevType, type)
      if (gap > 0) {
        if (y + gap > BOTTOM_CONTENT_IN) {
          newPage()
        } else {
          y += gap
        }
      }
    }
    prevType = type

    // Stipulation: safe fallback for any unexpected element types in body
    const spec = LAYOUT[type] ?? LAYOUT['action']
    const trimmed = text.replace(/\r\n/g, '\n').trimEnd()

    if (type === 'transition') {
      const rightEdge = spec.rightEdge ?? 7.5
      const lines = doc.splitTextToSize(trimmed || ' ', spec.w)
      for (const line of lines) {
        ensureLineFits()
        doc.text(line, rightEdge, y, { align: 'right', maxWidth: spec.w })
        y += LINE_HEIGHT_IN
      }
      continue
    }

    if (type === 'character' && spec.oneLine) {
      const t = (trimmed || ' ').toUpperCase()
      const parts = doc.splitTextToSize(t, spec.w)
      const first = parts[0] ?? t
      ensureLineFits()
      doc.text(first, spec.x, y)
      y += LINE_HEIGHT_IN
      continue
    }

    const body = type === 'character' ? trimmed.toUpperCase() : trimmed
    const lines = doc.splitTextToSize(body || ' ', spec.w)
    for (const line of lines) {
      ensureLineFits()
      doc.text(line, spec.x, y)
      y += LINE_HEIGHT_IN
    }
  }

  return doc.output('blob')
}

function cleanupBlobUrl(url: string) {
  try {
    URL.revokeObjectURL(url)
  } catch {
    /* ignore */
  }
}

/**
 * Print PDF via off-screen iframe; sync `about:blank` + fallback; download on total failure.
 */
export async function printScreenplayHidden(editor: Editor): Promise<void> {
  let blob: Blob
  try {
    blob = await generateScreenplayPDF(editor)
  } catch (e) {
    console.warn('Screenplay PDF generation failed:', e)
    return
  }

  const url = URL.createObjectURL(blob)
  let fallbackWin: Window | null = null
  try {
    fallbackWin = window.open('about:blank', '_blank')
  } catch {
    fallbackWin = null
  }

  const tryDownload = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = 'screenplay.pdf'
    a.rel = 'noopener'
    a.click()
  }

  let cleaned = false
  const safeCleanup = (iframe: HTMLIFrameElement) => {
    if (cleaned) return
    cleaned = true
    cleanupBlobUrl(url)
    iframe.remove()
    try {
      fallbackWin?.close()
    } catch {
      /* ignore */
    }
  }

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'position:absolute;top:-10000px;left:0;width:1px;height:1px;border:0;')

    let settled = false
    let started = false

    const finish = (ifRef: HTMLIFrameElement) => {
      if (settled) return
      settled = true
      safeCleanup(ifRef)
      resolve()
    }

    const runPrint = () => {
      if (started) return
      started = true
      try {
        const w = iframe.contentWindow
        if (!w?.print) throw new Error('print unavailable')
        w.addEventListener(
          'afterprint',
          () => {
            setTimeout(() => finish(iframe), 100)
          },
          { once: true },
        )
        w.focus()
        w.print()
        setTimeout(() => finish(iframe), 5000)
      } catch (e) {
        console.warn('Iframe PDF print failed, using fallback.', e)
        try {
          if (fallbackWin && !fallbackWin.closed) {
            fallbackWin.location.href = url
            fallbackWin.focus()
            fallbackWin.print()
          } else {
            tryDownload()
          }
        } catch (e2) {
          console.warn('Fallback print failed; offering download.', e2)
          tryDownload()
        } finally {
          setTimeout(() => finish(iframe), 2000)
        }
      }
    }

    iframe.addEventListener('load', () => setTimeout(runPrint, 200), { once: true })
    setTimeout(() => {
      if (settled || started) return
      started = true
      console.warn('PDF print iframe: load not observed in time, using fallback.')
      try {
        if (fallbackWin && !fallbackWin.closed) {
          fallbackWin.location.href = url
          fallbackWin.focus()
          fallbackWin.print()
        } else {
          tryDownload()
        }
      } catch (e) {
        console.warn('Fallback print failed; offering download.', e)
        tryDownload()
      } finally {
        setTimeout(() => finish(iframe), 2000)
      }
    }, 3000)

    document.body.appendChild(iframe)
    iframe.src = url
  })
}
