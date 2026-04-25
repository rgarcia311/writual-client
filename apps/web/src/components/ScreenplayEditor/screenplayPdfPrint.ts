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
    s === 'transition'
  ) {
    return s
  }
  return 'action'
}

/**
 * Industry spacing: one empty line between most blocks; no extra line in
 * character → parenthetical → dialogue chains.
 */
function interBlockGapInches(prev: ScreenplayElementType, next: ScreenplayElementType): number {
  if (
    (prev === 'character' && (next === 'parenthetical' || next === 'dialogue')) ||
    (prev === 'parenthetical' && next === 'dialogue')
  ) {
    return 0
  }
  return LINE_HEIGHT_IN
}

/**
 * Build a Letter-size PDF with WGA inch-based layout and line-level pagination.
 */
export async function generateScreenplayPDF(editor: Editor): Promise<Blob> {
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  doc.setFont('courier', 'normal')
  doc.setFontSize(12)

  const blocks: { type: ScreenplayElementType; text: string }[] = []
  editor.state.doc.forEach((node) => {
    if (node.type.name !== 'scriptBlock') return
    const type = normalizeType(node.attrs.elementType)
    let text = node.textContent ?? ''
    if (type === 'slugline') text = text.toUpperCase()
    blocks.push({ type, text })
  })

  let y = TOP_CONTENT_IN
  let pageNum = 1

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

  for (let i = 0; i < blocks.length; i++) {
    const { type, text } = blocks[i]
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

    const spec = LAYOUT[type]
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
