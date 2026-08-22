'use client'

import type { Editor } from '@tiptap/core'
import { jsPDF } from 'jspdf'

import type { ScreenplayElementType } from './ScreenplayExtension'
import { CONTD_LITERAL_RE, normalizeCharacterCueName } from './ScreenplayExtension'
import {
  getScreenplayInterBlockGapInches,
  SCREENPLAY_LINE_HEIGHT_INCHES,
} from './screenplaySpacing'
import {
  BASELINE_OFFSET_IN,
  buildPdfLayout,
  CONTACT_BLOCK_TOP_IN,
  FIRST_BASELINE_IN,
  LINES_PER_PAGE,
  MIN_LINES_AFTER_SPLIT,
  MIN_LINES_BEFORE_SPLIT,
  PAGE_NUM_BASELINE_IN,
  readLayoutConfigFromPage,
  SPLIT_WITH_MORE_TYPES,
  TEXT_RIGHT_IN,
  TITLE_BLOCK_TOP_IN,
  TITLE_PAGE_TYPES_PDF,
} from './screenplayPdfLayout'
import type { ScreenplayLayoutConfig } from '@/lib/screenplayLayout'

/** Same face as on-screen `next/font` Courier Prime — TTF in /public/fonts (OFL). */
const COURIER_PRIME_PUBLIC_TTF = '/fonts/CourierPrime-Regular.ttf'
const COURIER_PRIME_VFS_NAME = 'CourierPrime-Regular.ttf'
const COURIER_PRIME_PDF_FAMILY = 'CourierPrime'

let courierPrimeRegularBase64: string | null = null

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

async function loadCourierPrimeBase64(): Promise<string> {
  if (courierPrimeRegularBase64 != null) return courierPrimeRegularBase64
  const res = await fetch(COURIER_PRIME_PUBLIC_TTF)
  if (!res.ok) {
    throw new Error(`Failed to load Courier Prime for PDF (${res.status})`)
  }
  courierPrimeRegularBase64 = arrayBufferToBase64(await res.arrayBuffer())
  return courierPrimeRegularBase64
}

/** Embeds Courier Prime; returns jsPDF font family name to pass to `setFont`. */
async function setupScreenplayPdfFont(doc: jsPDF): Promise<'CourierPrime' | 'courier'> {
  try {
    const b64 = await loadCourierPrimeBase64()
    doc.addFileToVFS(COURIER_PRIME_VFS_NAME, b64)
    doc.addFont(COURIER_PRIME_VFS_NAME, COURIER_PRIME_PDF_FAMILY, 'normal')
    return COURIER_PRIME_PDF_FAMILY
  } catch (e) {
    console.warn('Courier Prime embed failed, using built-in Courier.', e)
    return 'courier'
  }
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
 * Build a Letter-size PDF with WGA inch-based layout and line-level pagination.
 * Title-page blocks (title / author / contact) at the start of the document are
 * rendered on a dedicated unnumbered page; the screenplay body begins on page 1.
 *
 * `layoutConfig` is this document's inferred per-element geometry. Omit it and the live
 * `.screenplay-page` element is read instead, so the PDF matches what is on screen; pass `null`
 * to force the WGA defaults.
 */
export async function generateScreenplayPDF(
  editor: Editor,
  layoutConfig?: ScreenplayLayoutConfig | null,
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  const bodyFont = await setupScreenplayPdfFont(doc)
  doc.setFont(bodyFont, 'normal')
  doc.setFontSize(12)

  const layout = buildPdfLayout(
    layoutConfig === undefined ? readLayoutConfigFromPage() : layoutConfig,
  )

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
    // Each block is separated by one blank line (SCREENPLAY_LINE_HEIGHT_INCHES) to mirror the
    // CSS padding-bottom:12pt applied to title/author blocks in the editor.
    let tay = TITLE_BLOCK_TOP_IN + BASELINE_OFFSET_IN
    let isFirstTitleBlock = true
    for (const { text } of titleAuthorLines) {
      if (!isFirstTitleBlock) {
        tay += SCREENPLAY_LINE_HEIGHT_INCHES // one blank line between successive title-area blocks
      }
      isFirstTitleBlock = false
      const lines = doc.splitTextToSize(text || ' ', 5.0)
      for (const line of lines) {
        doc.text(line, 4.25, tay, { align: 'center', maxWidth: 5.0 })
        tay += SCREENPLAY_LINE_HEIGHT_INCHES
      }
    }

    // Contact info: bottom-left. Use the full LAYOUT width so that a single-line
    // address (one contact block = one PDF line) is never word-wrapped.
    const contactSpec = layout['contact']
    let cy = CONTACT_BLOCK_TOP_IN + BASELINE_OFFSET_IN
    for (const { text } of contactLines) {
      const lines = doc.splitTextToSize(text || ' ', contactSpec.w)
      for (const line of lines) {
        doc.text(line, contactSpec.x, cy)
        cy += SCREENPLAY_LINE_HEIGHT_INCHES
      }
    }

    if (bodyBlocks.length > 0) {
      doc.addPage()
      doc.setFont(bodyFont, 'normal')
      doc.setFontSize(12)
    }
  }

  // ── Render screenplay body ────────────────────────────────────────────────
  const blocksToRender = bodyBlocks

  /** 0-based index of the next line to draw on the current page (0 … LINES_PER_PAGE). */
  let line = 0
  let pageNum = 1

  /** Baseline of line `n`. Negative / >= LINES_PER_PAGE intentionally address the margins, where
   *  the "(MORE)" and "NAME (CONT'D)" continuation markers live. */
  const baselineOf = (n: number) => FIRST_BASELINE_IN + n * SCREENPLAY_LINE_HEIGHT_INCHES
  const linesLeft = () => LINES_PER_PAGE - line

  // Page 1 of the screenplay body is intentionally left unnumbered (standard
  // screenplay convention); numbering starts on the second body page.

  const newPage = () => {
    doc.addPage()
    pageNum += 1
    doc.setFont(bodyFont, 'normal')
    doc.setFontSize(12)
    doc.text(`${pageNum}.`, TEXT_RIGHT_IN, PAGE_NUM_BASELINE_IN, { align: 'right' })
    line = 0
  }

  const drawLine = (text: string, x: number) => {
    if (linesLeft() === 0) newPage()
    doc.text(text, x, baselineOf(line))
    line += 1
  }

  /** Wrapped line count of a block as this layout will render it. */
  const blockLineCount = (b: { type: ScreenplayElementType; text: string }): number => {
    const spec = layout[b.type] ?? layout['action']
    if (spec.oneLine) return 1
    return doc.splitTextToSize(b.text.trimEnd() || ' ', spec.w).length
  }

  /**
   * Lines that must stay together starting at block `idx`: the block itself, the blank line before
   * whatever follows, and the opening `MIN_LINES_AFTER_SPLIT` lines of it.
   *
   * A character cue chains through its parentheticals to the first dialogue block (those gaps are
   * zero), so it is never stranded above its own speech; a scene heading only needs the top of the
   * next block, so it is never the last line on a page. Mirrors the cue+dialogue group check in
   * `PageBreakPlugin.ts`, which the export previously had no equivalent of at all.
   */
  const linesToKeepTogether = (idx: number): number => {
    const self = blocksToRender[idx]
    if (!self) return 1
    let total = blockLineCount(self)
    let prev: ScreenplayElementType = self.type
    for (let j = idx + 1; j < blocksToRender.length; j++) {
      const next = blocksToRender[j]
      if (!next) break
      if (self.type === 'character' && next.type !== 'parenthetical' && next.type !== 'dialogue') break
      total += Math.round(
        getScreenplayInterBlockGapInches(prev, next.type) / SCREENPLAY_LINE_HEIGHT_INCHES,
      )
      const lines = blockLineCount(next)
      total += Math.min(MIN_LINES_AFTER_SPLIT, lines)
      // Only a cue keeps walking (through parentheticals); everything else stops at the first block.
      if (self.type !== 'character' || next.type === 'dialogue' || lines >= MIN_LINES_AFTER_SPLIT) break
      prev = next.type
    }
    return total
  }

  let prevType: ScreenplayElementType | null = null
  // Automatic (CONT'D): tracks the last speaker so a character resuming after an interruption is
  // marked. A scene heading (slugline) resets continuation; a different character cue resets it.
  let lastSpeaker: string | null = null

  for (let i = 0; i < blocksToRender.length; i++) {
    const block = blocksToRender[i]
    if (!block) continue
    const { type, text } = block

    // ── Inter-block gap, in whole blank lines. A blank line never leads a page: when the gap
    //    would run past the last line, break instead and start the next block flush at the top.
    if (i > 0 && prevType != null) {
      const gapLines = Math.round(
        getScreenplayInterBlockGapInches(prevType, type) / SCREENPLAY_LINE_HEIGHT_INCHES,
      )
      if (gapLines > 0) {
        if (line + gapLines >= LINES_PER_PAGE) newPage()
        else line += gapLines
      }
    }
    prevType = type

    let charContd = false
    if (type === 'slugline') {
      lastSpeaker = null
    } else if (type === 'character') {
      const name = normalizeCharacterCueName(text)
      if (name) {
        charContd = lastSpeaker === name && !CONTD_LITERAL_RE.test(text)
        lastSpeaker = name
      }
    }

    // Stipulation: safe fallback for any unexpected element types in body
    const spec = layout[type] ?? layout['action']
    const trimmed = text.replace(/\r\n/g, '\n').trimEnd()

    // ── Widow / orphan guards ───────────────────────────────────────────────
    // A cue must keep at least the opening lines of its speech, and a scene heading must never be
    // the last line on a page (`break-after: avoid` on screen). Without these the naive per-line
    // fit check stranded cues alone at the page bottom.
    if ((type === 'character' || type === 'slugline') && linesLeft() < linesToKeepTogether(i)) {
      newPage()
    }

    if (type === 'transition') {
      const rightEdge = spec.rightEdge ?? TEXT_RIGHT_IN
      const lines = doc.splitTextToSize(trimmed || ' ', spec.w)
      for (const l of lines) {
        if (linesLeft() === 0) newPage()
        doc.text(l, rightEdge, baselineOf(line), { align: 'right', maxWidth: spec.w })
        line += 1
      }
      continue
    }

    if (type === 'character' && spec.oneLine) {
      const base = (trimmed || ' ').toUpperCase()
      const t = charContd ? `${base} (CONT'D)` : base
      const parts = doc.splitTextToSize(t, spec.w)
      drawLine(parts[0] ?? t, spec.x)
      continue
    }

    const body =
      type === 'character'
        ? charContd
          ? `${trimmed.toUpperCase()} (CONT'D)`
          : trimmed.toUpperCase()
        : trimmed
    let pending: string[] = doc.splitTextToSize(body || ' ', spec.w)

    // ── Speech crossing a page boundary: "(MORE)" + "NAME (CONT'D)" ─────────
    // Both markers sit in the margins, outside the 54-line band, matching how reference exports
    // typeset them — so a split costs no body line and the page still holds a full 54.
    let movedToFreshPage = false
    while (SPLIT_WITH_MORE_TYPES.has(type) && pending.length > linesLeft()) {
      const head = linesLeft()
      if (head < MIN_LINES_BEFORE_SPLIT || pending.length - head < MIN_LINES_AFTER_SPLIT) {
        // Can't split here without stranding an orphan/widow — move the whole block instead.
        // `movedToFreshPage` stops a block taller than one page from looping forever.
        if (movedToFreshPage) break
        newPage()
        movedToFreshPage = true
        continue
      }
      for (const l of pending.slice(0, head)) drawLine(l, spec.x)
      doc.text('(MORE)', layout['character'].x, baselineOf(LINES_PER_PAGE))
      newPage()
      if (lastSpeaker) {
        doc.text(`${lastSpeaker} (CONT'D)`, layout['character'].x, baselineOf(-1))
      }
      pending = pending.slice(head)
    }

    for (const l of pending) drawLine(l, spec.x)
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
export async function printScreenplayHidden(
  editor: Editor,
  layoutConfig?: ScreenplayLayoutConfig | null,
): Promise<void> {
  let blob: Blob
  try {
    blob = await generateScreenplayPDF(editor, layoutConfig)
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
