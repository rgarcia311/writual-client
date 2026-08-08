'use client'

import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from 'prosemirror-view'

import {
  SCREENPLAY_CONTENT_HEIGHT_PX,
  SCREENPLAY_DIALOGUE_INDENT_PX,
  SCREENPLAY_INTER_PAGE_GAP_PX,
  SCREENPLAY_LINE_HEIGHT_PX,
  SCREENPLAY_MARGIN_BOTTOM_PX,
  SCREENPLAY_MARGIN_LEFT_PX,
  SCREENPLAY_MARGIN_TOP_PX,
  SCREENPLAY_PAPER_WIDTH_PX,
  SCREENPLAY_PARENTHETICAL_INDENT_PX,
} from './screenplayPaperLayout'
import { normalizeCharacterCueName } from './ScreenplayExtension'

/* ── Title-page element types ──────────────────────────────────────────────── */

const TITLE_PAGE_TYPES = new Set(['title', 'author', 'contact'])

/** True when script blocks begin with contiguous title-cover types ahead of body. */
function docStartsWithCoverTitle(doc: PMNode): boolean {
  let sawCover = false
  for (let i = 0; i < doc.childCount; i++) {
    const n = doc.child(i)
    if (n.type.name !== 'scriptBlock') continue
    const et = (n.attrs.elementType as string) || 'action'
    if (TITLE_PAGE_TYPES.has(et)) {
      sawCover = true
      continue
    }
    break
  }
  return sawCover
}

/** Gutter screenplay page vs physical layout sheet (cover sheet occupies layout slot 1 without a numeral on body page 1). */
function screenplayPageNumForGap(coverPrefix: boolean, layoutPageIdx: number): number {
  return coverPrefix ? layoutPageIdx : layoutPageIdx + 1
}

/* ── Layout constants ──────────────────────────────────────────────────────── */

/** Same 864px interval as `.screenplay-page` min-height content band (54 × 16px lines). */
const CONTENT_HEIGHT = SCREENPLAY_CONTENT_HEIGHT_PX
/** Bottom margin band + inter-page gap + top margin band (see PageBreakPlugin DOM). */
const WIDGET_HEIGHT =
  SCREENPLAY_MARGIN_BOTTOM_PX + SCREENPLAY_INTER_PAGE_GAP_PX + SCREENPLAY_MARGIN_TOP_PX

/**
 * `computeDecorations()` predicts each break widget's height analytically (before the real
 * widgets + `:has(+ .page-break-gap)` CSS rules are live). Small mismatches between that
 * prediction and what the browser actually renders compound across every later break in a long
 * document. These bound the self-correction pass in `recalculateWithSelfCorrection()` that
 * re-measures after dispatch and redoes the computation if drift is found.
 */
const MAX_CORRECTION_PASSES = 2
const GAP_HEIGHT_EPSILON_PX = 1

/**
 * Target gap between the title page's contact block and the page-content boundary (the
 * bottom-margin band starts right after `CONTENT_HEIGHT`) — matches the small residual gap
 * screenplay title pages conventionally leave above the bottom margin (~15pt in source PDFs).
 */
const TITLE_PAGE_CONTACT_BOTTOM_GAP_PX = 20

/**
 * Element types that may split mid-block across a page break (matching source-PDF behavior)
 * instead of always moving whole to the next page. `character`/`slugline`/`transition` are
 * excluded: cues are short and already kept with their dialogue by the orphan/widow check below,
 * and sluglines/transitions are single short lines with their own widow check.
 */
const SPLITTABLE_TYPES = new Set(['action', 'dialogue', 'parenthetical'])
/** Lines that must remain on the current page (after reserving room for "(MORE)") before a split
 * is attempted — standard widow/orphan-control default, avoids stranding a single line alone. */
const MIN_LINES_BEFORE_SPLIT = 2
/** Lines that must remain for the continuation on the next page before a split is attempted. */
const MIN_LINES_AFTER_SPLIT = 2
/** Per-`elementType` left indent (px) used to compute a mid-block split gap's full-page bleed —
 * see `createGapElement`'s `inlineLeftPadPx`. `action` has no indent. */
const SPLIT_LEFT_PAD_PX: Record<string, number> = {
  action: 0,
  dialogue: SCREENPLAY_DIALOGUE_INDENT_PX,
  parenthetical: SCREENPLAY_PARENTHETICAL_INDENT_PX,
}

/**
 * Compare against the industry 16px line grid (54 lines × 16px = 864px content band).
 * Sub-pixel bottoms from zoom/font metrics must not push a line that still fits on-page.
 */
function layoutBottomExceedsPageContentEnd(
  layoutBottom: number,
  pageContentEnd: number,
  pageContentStart: number,
): boolean {
  const relativeBottom = layoutBottom - pageContentStart
  const maxLines = (pageContentEnd - pageContentStart) / SCREENPLAY_LINE_HEIGHT_PX
  const usedLines = Math.ceil((relativeBottom - 1e-3) / SCREENPLAY_LINE_HEIGHT_PX)
  return usedLines > maxLines
}

/**
 * Script blocks use `padding-bottom: var(--sp-line-single)` as the blank line *before* the next
 * element. That spacer does not need to fit on the same page as the last ink line when deciding
 * whether a block "overflows" — same idea as PDF flow. Subtract it for overflow checks only.
 */
function layoutBottomForPaginationOverflow(
  elementType: string | undefined,
  layoutBottom: number,
): number {
  const t = elementType ?? 'action'
  if (t === 'dialogue' || t === 'action' || t === 'slugline' || t === 'transition') {
    return layoutBottom - SCREENPLAY_LINE_HEIGHT_PX
  }
  return layoutBottom
}

/* ── Plugin key & meta ─────────────────────────────────────────────────────── */

interface PageBreakMeta {
  decorations: DecorationSet
}

const pageBreakKey = new PluginKey<DecorationSet>('pageBreaks')

/* ── Block metrics ─────────────────────────────────────────────────────────── */

interface BlockEntry {
  pos: number
  node: PMNode
}

function collectScriptBlocks(doc: PMNode): BlockEntry[] {
  const out: BlockEntry[] = []
  doc.forEach((node, offset) => {
    if (node.type.name === 'scriptBlock') {
      out.push({ pos: offset, node })
    }
  })
  return out
}

/** Map post-`transform: scale()` visual pixels to layout CSS px (`getBoundingClientRect` / `offsetHeight`). */
function layoutScaleFromEditorDom(dom: HTMLElement): number {
  const h = dom.offsetHeight
  if (h === 0) return 1
  const r = dom.getBoundingClientRect().height
  const s = r / h
  if (!Number.isFinite(s) || s <= 0) return 1
  return Math.abs(s - 1) < 0.001 ? 1 : s
}

function yLayoutInPm(el: HTMLElement, pmRect: DOMRect, scale: number): { top: number; bottom: number } {
  const r = el.getBoundingClientRect()
  return {
    top: (r.top - pmRect.top) / scale,
    bottom: (r.bottom - pmRect.top) / scale,
  }
}

/* ── Mid-block split measurement ──────────────────────────────────────────── */

/**
 * Resolves the single text node under a script block's content element, regardless of how many
 * wrapper `<div>`s Tiptap's NodeView rendering nests in between (verified to vary by version —
 * do not assume any fixed depth). Returns `null` unless there's exactly one text node, keeping
 * mid-block splitting conservative for any content shape more complex than flat text.
 */
function findSoleTextNode(root: HTMLElement): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const first = walker.nextNode() as Text | null
  if (!first) return null
  if (walker.nextNode()) return null // more than one text node — keep this conservative
  return first
}

/**
 * Finds the character offset (within a script block's single text-node content) where its
 * `targetLineIndex`-th visual line (0-based) begins, by binary-searching a `Range`'s rendered
 * `top` — a monotonically non-decreasing step function of character offset for this app's LTR
 * monospace body text. Used to split a block's rendered text across a page break mid-line,
 * matching how source PDFs wrap. Returns `null` on any condition that makes splitting unsafe
 * (multi-node/marked content, empty text, or fewer visual lines than requested) — callers must
 * treat `null` as "fall back to moving the whole block," never as an error to surface.
 *
 * `blockTop` is the block's PM-space top (matching this file's `naturalTop`/`blockTop`
 * convention); `pmRect`/`scale` convert it back to raw viewport px to compare against the raw
 * `getClientRects()` measurements this function takes internally (the inverse of `yLayoutInPm`).
 */
function findLineStartOffset(
  contentEl: HTMLElement,
  targetLineIndex: number,
  blockTop: number,
  pmRect: DOMRect,
  scale: number,
): number | null {
  if (targetLineIndex <= 0) return 0
  const textNode = findSoleTextNode(contentEl)
  if (!textNode) return null
  const text = textNode.textContent ?? ''
  const len = text.length
  if (len === 0) return null

  const range = document.createRange()
  // A 1-character (non-collapsed) range is used rather than a collapsed one: collapsed ranges
  // unreliably return empty `getClientRects()` results across browsers, while a real character
  // span reliably reports the visual line it renders on.
  const caretTopViewport = (offset: number): number => {
    const start = Math.max(0, Math.min(offset, len - 1))
    range.setStart(textNode, start)
    range.setEnd(textNode, start + 1)
    const rects = range.getClientRects()
    return rects.length > 0 ? rects[0].top : contentEl.getBoundingClientRect().top
  }

  const thresholdViewportY = pmRect.top + (blockTop + targetLineIndex * SCREENPLAY_LINE_HEIGHT_PX) * scale
  const epsilonPx = 0.5 * scale

  let lo = 0
  let hi = len
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (caretTopViewport(mid) >= thresholdViewportY - epsilonPx) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }

  if (lo >= len) return null // fewer visual lines than requested — caller should fall back

  if (process.env.NODE_ENV === 'development') {
    const actualTop = caretTopViewport(lo)
    const driftPx = Math.abs(actualTop - thresholdViewportY) / scale
    if (driftPx > 1) {
      console.debug(
        `[PageBreakPlugin] findLineStartOffset drift ${driftPx.toFixed(2)}px at offset ${lo} (line ${targetLineIndex})`,
      )
    }
  }

  return lo
}

/* ── Widget DOM builder ────────────────────────────────────────────────────── */

function findBreakAnchorBottom(
  blocks: BlockEntry[],
  blockIndex: number,
  editorView: EditorView,
  pmRect: DOMRect,
  scale: number,
  cursorOffset: number,
  pageContentStart: number,
  pageContentEnd: number,
): number | null {
  for (let j = blockIndex - 1; j >= 0; j--) {
    const t = blocks[j].node.attrs.elementType as string
    if (t !== 'character' && t !== 'parenthetical') break

    const anchorEl = editorView.nodeDOM(blocks[j].pos) as HTMLElement | null
    if (!anchorEl) continue

    let bottomRaw = yLayoutInPm(anchorEl, pmRect, scale).bottom
    bottomRaw = layoutBottomForPaginationOverflow(t, bottomRaw)
    const projected = bottomRaw + cursorOffset
    if (!layoutBottomExceedsPageContentEnd(projected, pageContentEnd, pageContentStart)) {
      return bottomRaw
    }
  }
  return null
}

/**
 * Walks backward from a dialogue/parenthetical block through its governing character/parenthetical
 * chain to find the speaker's name, for the synthetic "CHARACTER (CONT'D)" cue rendered when that
 * block splits across a page break. Mirrors `findBreakAnchorBottom`'s chain-walk, resolving a name
 * instead of a bottom-y.
 */
function findGoverningCharacterName(blocks: BlockEntry[], blockIndex: number): string | null {
  for (let j = blockIndex - 1; j >= 0; j--) {
    const t = blocks[j].node.attrs.elementType as string
    if (t === 'character') return normalizeCharacterCueName(blocks[j].node.textContent ?? '') || null
    if (t !== 'parenthetical' && t !== 'dialogue') break
  }
  return null
}

interface BlockSplitResult {
  /** Absolute ProseMirror doc position, strictly inside the block's text, where the mid-block
   * gap widget is inserted. */
  splitDocPos: number
  /** PM-space y (matching `naturalTop`/`blockTop` convention) of the split boundary — the
   * reference point the gap's `remainder` is computed from, in place of a previous block's bottom. */
  splitLineTopPx: number
  /** Whether this is a dialogue/parenthetical split needing "(MORE)" / "CHARACTER (CONT'D)". */
  more: boolean
  contdSpeakerName: string | null
}

/**
 * Attempts to split an overflowing block's own rendered text at a line boundary — matching how
 * source PDFs wrap a block across a page — instead of moving the whole block to the next page.
 * Every failure/uncertainty path returns `null`; callers must fall back to the existing
 * whole-block-move behavior exactly as before, never treating `null` as an error.
 */
function attemptBlockSplit(
  editorView: EditorView,
  blocks: BlockEntry[],
  blockIndex: number,
  pos: number,
  node: PMNode,
  elementType: string,
  el: HTMLElement,
  naturalTop: number,
  naturalBottom: number,
  blockTop: number,
  pageContentEnd: number,
  pmRect: DOMRect,
  scale: number,
): BlockSplitResult | null {
  if (!SPLITTABLE_TYPES.has(elementType)) return null

  // Not `:scope >`: Tiptap nests `[data-node-view-content]` at varying depth depending on version
  // (confirmed via live DOM inspection to sit two levels deep, not one, in the installed version) —
  // a plain descendant match is robust to that since a script block has exactly one such element.
  const contentEl = el.querySelector<HTMLElement>('[data-node-view-content]')
  if (!contentEl) return null

  const linesAvailable = Math.floor((pageContentEnd - blockTop) / SCREENPLAY_LINE_HEIGHT_PX)
  const more = elementType !== 'action'
  // Dialogue/parenthetical reserve one line on this page for "(MORE)"; action needs no marker.
  const usableLines = more ? linesAvailable - 1 : linesAvailable
  if (usableLines < MIN_LINES_BEFORE_SPLIT) return null

  // Trailing blank-line spacer (dialogue/action's own padding-bottom) isn't a real text line —
  // same adjustment the overflow check itself uses (`layoutBottomForPaginationOverflow`).
  const naturalInkBottom = layoutBottomForPaginationOverflow(elementType, naturalBottom)
  const totalLines = Math.round((naturalInkBottom - naturalTop) / SCREENPLAY_LINE_HEIGHT_PX)
  if (usableLines >= totalLines) return null // block actually fits — defensive no-op

  const tailLines = totalLines - usableLines
  if (tailLines < MIN_LINES_AFTER_SPLIT) return null

  const offset = findLineStartOffset(contentEl, usableLines, blockTop, pmRect, scale)
  if (offset == null) return null

  const textNode = findSoleTextNode(contentEl)
  if (!textNode) return null
  const text = textNode.textContent ?? ''
  if (text.slice(offset).trim() === '') return null // no real continuation content

  const splitDocPos = editorView.posAtDOM(textNode, offset)
  if (!(splitDocPos > pos + 1 && splitDocPos < pos + node.nodeSize - 1)) return null

  let contdSpeakerName: string | null = null
  if (more) {
    contdSpeakerName = findGoverningCharacterName(blocks, blockIndex)
    if (contdSpeakerName == null) return null // no governing cue — malformed doc, prefer fallback
  }

  return {
    splitDocPos,
    splitLineTopPx: blockTop + usableLines * SCREENPLAY_LINE_HEIGHT_PX,
    more,
    contdSpeakerName,
  }
}

interface GapOpts {
  remainder: number
  pageNumber: number
  /** Dialogue/parenthetical split: render "(MORE)" at the bottom of the visible portion. */
  more?: boolean
  /** Dialogue/parenthetical split: render "{NAME} (CONT'D)" at the top of the continuation. */
  contdSpeakerName?: string
  /** Set for a mid-block split gap (not a between-block one): overrides the default full-bleed
   * width/margin formula (sized against `.ProseMirror`) with one sized against `.script-block`'s
   * own box instead, since a mid-text widget renders nested inside the block's content div. Value
   * is the split block's `elementType` left indent (0 for action). */
  inlineLeftPadPx?: number
}

function createGapElement(opts: GapOpts): HTMLElement {
  // <PROTECTED>
  const wrapper = document.createElement('div')
  wrapper.className = 'page-break-gap'
  wrapper.contentEditable = 'false'
  if (opts.inlineLeftPadPx != null) {
    wrapper.style.width = `${SCREENPLAY_PAPER_WIDTH_PX}px`
    wrapper.style.marginLeft = `-${opts.inlineLeftPadPx + SCREENPLAY_MARGIN_LEFT_PX}px`
  }

  const rem = document.createElement('div')
  rem.className = 'page-break-gap__remainder'
  rem.style.height = `${Math.max(0, opts.remainder)}px`
  if (opts.more) {
    const more = document.createElement('span')
    more.className = 'page-break-gap__more'
    more.textContent = '(MORE)'
    rem.appendChild(more)
  }

  const botMargin = document.createElement('div')
  botMargin.className = 'page-break-gap__bottom-margin'

  const gap = document.createElement('div')
  gap.className = 'page-break-gap__gap'
  gap.style.backgroundColor = '#ffffff'

  const topMargin = document.createElement('div')
  topMargin.className = 'page-break-gap__top-margin'

  if (opts.pageNumber >= 2) {
    const num = document.createElement('span')
    num.className = 'page-break-gap__page-number'
    num.textContent = `${opts.pageNumber}.`
    topMargin.appendChild(num)
  }

  if (opts.contdSpeakerName) {
    const contd = document.createElement('span')
    contd.className = 'page-break-gap__contd'
    contd.textContent = `${opts.contdSpeakerName} (CONT'D)`
    topMargin.appendChild(contd)
  }

  const trailingSheet = document.createElement('div')
  trailingSheet.className = 'page-break-gap__sheet-trailing'
  trailingSheet.append(rem, botMargin)

  const leadingSheet = document.createElement('div')
  leadingSheet.className = 'page-break-gap__sheet-leading'
  leadingSheet.appendChild(topMargin)

  wrapper.append(trailingSheet, gap, leadingSheet)
  // </PROTECTED>
  return wrapper
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PageBreakExtension
   ═══════════════════════════════════════════════════════════════════════════════ */

export const PageBreakExtension = Extension.create({
  name: 'pageBreaks',

  addProseMirrorPlugins() {
    const plugin = new Plugin<DecorationSet>({
      key: pageBreakKey,

      state: {
        init: () => DecorationSet.empty,
        apply(tr, value) {
          const meta = tr.getMeta(pageBreakKey) as PageBreakMeta | undefined
          if (meta && Object.prototype.hasOwnProperty.call(meta, 'decorations')) {
            return meta.decorations
          }
          if (tr.docChanged) return value.map(tr.mapping, tr.doc)
          return value
        },
      },

      props: {
        decorations(state) {
          return pageBreakKey.getState(state)
        },
      },

      view(editorView) {
        let timerId: ReturnType<typeof setTimeout> | null = null
        let rafId: number | null = null
        let settleTimerId: ReturnType<typeof setTimeout> | null = null
        let resizeObserver: ResizeObserver | null = null
        let zoomAttrObserver: MutationObserver | null = null
        let measuring = false
        /** Expected height of each `.page-break-gap` widget, in DOM order, from the last
         * `computeDecorations()` pass — compared against actual rendered heights to detect drift. */
        let lastExpectedGapHeights: number[] = []

        function dispatchDecorations(set: DecorationSet) {
          const tr = editorView.state.tr.setMeta(pageBreakKey, { decorations: set })
          editorView.dispatch(tr)
        }

        function computeDecorations(): { set: DecorationSet; totalPages: number } {
          const state = editorView.state
          const doc = state.doc
          const blocks = collectScriptBlocks(doc)
          if (blocks.length === 0) return { set: DecorationSet.empty, totalPages: 1 }

          const decorations: Decoration[] = []
          // Recorded in the same order widgets are pushed to `decorations` (DOM order, since `pos`
          // is monotonically increasing) — read back by `measureGapHeightDrift()` after dispatch.
          const expectedGapHeights: number[] = []
          const coverPrefix = docStartsWithCoverTitle(doc)
          const pmRect = editorView.dom.getBoundingClientRect()
          const scale = layoutScaleFromEditorDom(editorView.dom as HTMLElement)

          let cursorOffset = 0
          let pageIndex = 1
          let hasFiredTitleBreak = false

          for (let i = 0; i < blocks.length; i++) {
            const { pos, node } = blocks[i]
            const el = editorView.nodeDOM(pos) as HTMLElement
            if (!el) continue

            // Layout-space Y relative to ProseMirror (parent may use `transform: scale(zoom)`).
            const { top: naturalTop, bottom: naturalBottom } = yLayoutInPm(el, pmRect, scale)

            // Projected positions (including the height of any widgets we've added so far)
            const blockTop = naturalTop + cursorOffset
            const blockBottom = naturalBottom + cursorOffset

            // Calculate the absolute boundaries of the current page
            const pageContentStart = (pageIndex - 1) * (CONTENT_HEIGHT + WIDGET_HEIGHT)
            const pageContentEnd = pageContentStart + CONTENT_HEIGHT

            // Failsafe: Fast-forward page index if a massive block completely bypassed a page break
            while (blockTop >= pageIndex * (CONTENT_HEIGHT + WIDGET_HEIGHT)) {
              pageIndex++
            }

            let forceBreak = false
            const elementType = node.attrs.elementType as string || 'action'

            // ── Title-page → body forced break ───────────────────────────────
            // When the first non-title-page block immediately follows title-page
            // content (title | author | contact), force a page break so the title
            // page always occupies its own page and the screenplay body begins on
            // the next. Fires at most once per computation pass via hasFiredTitleBreak.
            //
            // `hasFiredTitleBreak` replaces the previous `pageIndex === 1` guard:
            // if multiple contact blocks overflow the page the regular break fires
            // first, advancing pageIndex beyond 1 before we reach this check. The
            // flag ensures the forced break still fires in that scenario.
            //
            // `continue` is required: blockTop / blockBottom / pageContentEnd are
            // captured before the cursorOffset shift; falling through would re-evaluate
            // those stale bounds and risk a duplicate break.
            if (
              !hasFiredTitleBreak &&
              !TITLE_PAGE_TYPES.has(elementType) &&
              i > 0 &&
              TITLE_PAGE_TYPES.has(blocks[i - 1].node.attrs.elementType as string)
            ) {
              // Use current pageIndex so the remainder is correct even if the
              // title-page content overflowed past page 1.
              const titlePageEnd = (pageIndex - 1) * (CONTENT_HEIGHT + WIDGET_HEIGHT) + CONTENT_HEIGHT

              // Push the contact block (address/phone) down so it sits near the page's bottom
              // margin, matching standard title-page conventions, instead of leaving that space
              // as blank gap-widget padding after it. `Screenplay.css`'s fixed padding-top on
              // `[data-element-type='contact']` doesn't account for how much title/author
              // content precedes it or how much page space remains, so it's computed here instead.
              const firstContactIdx = blocks.findIndex(
                (b, idx) => idx < i && (b.node.attrs.elementType as string) === 'contact',
              )
              if (firstContactIdx !== -1) {
                const firstContactEl = editorView.nodeDOM(blocks[firstContactIdx].pos) as HTMLElement | null
                const lastTitleBlockEl = editorView.nodeDOM(blocks[i - 1].pos) as HTMLElement | null
                if (firstContactEl && lastTitleBlockEl) {
                  const currentLastBottom = yLayoutInPm(lastTitleBlockEl, pmRect, scale).bottom
                  const desiredLastBottom = titlePageEnd - TITLE_PAGE_CONTACT_BOTTOM_GAP_PX
                  const delta = desiredLastBottom - currentLastBottom
                  if (delta > GAP_HEIGHT_EPSILON_PX) {
                    const oldPaddingTop = parseFloat(getComputedStyle(firstContactEl).paddingTop) || 0
                    firstContactEl.style.paddingTop = `${oldPaddingTop + delta}px`
                    void editorView.dom.offsetHeight // force reflow before re-measuring below
                  }
                }
              }

              const prevEntry = blocks[i - 1]
              const prevEl = editorView.nodeDOM(prevEntry.pos) as HTMLElement
              let prevBottomRaw = 0
              let prevBottom = 0
              if (prevEl) {
                prevBottomRaw = yLayoutInPm(prevEl, pmRect, scale).bottom
                prevBottom = prevBottomRaw + cursorOffset
              }

              const remainder = Math.max(0, titlePageEnd - prevBottom)
              expectedGapHeights.push(remainder + WIDGET_HEIGHT)

              decorations.push(
                Decoration.widget(
                  pos,
                  createGapElement({
                    remainder,
                    pageNumber: screenplayPageNumForGap(coverPrefix, pageIndex),
                  }),
                  {
                    side: -1,
                    type: 'block' as const,
                    marks: [],
                    stopEvent: () => true,
                    key: `tp-break-${pos}`,
                  },
                ),
              )

              const naturalGap = naturalTop - prevBottomRaw
              const actualShift = remainder + WIDGET_HEIGHT - naturalGap
              cursorOffset += actualShift
              pageIndex++
              hasFiredTitleBreak = true
              continue
            }
            // ── End title-page forced break ───────────────────────────────────

            // ── Title-page blocks: never insert regular breaks ────────────────
            // The forced break above is the only correct way to end the title
            // page. Regular breaks within title-page-type blocks (title | author
            // | contact) would split contact info across pages. The CSS
            // `contact + contact { padding-top: 0 }` combinator is also
            // unreliable once a widget appears between siblings, so this guard
            // is the definitive fix.
            if (TITLE_PAGE_TYPES.has(elementType)) {
              continue
            }

            // --- Orphan / Widow Group Checks ---
            // Run the cue+dialogue group check whenever the cue itself would not independently
            // overflow (same tolerance as the core break check). The previous strict
            // `blockBottom <= pageContentEnd` guard skipped the group check in the sub-pixel
            // boundary window, which let the dialogue break onto the next page alone.
            const characterFitsCurrentPage = !layoutBottomExceedsPageContentEnd(
              layoutBottomForPaginationOverflow('character', blockBottom),
              pageContentEnd,
              pageContentStart,
            )
            if (elementType === 'character' && characterFitsCurrentPage && blockTop > pageContentStart + 1) {
              let groupBottom = naturalBottom
              let endedOnDialogue = false
              for (let j = i + 1; j < blocks.length; j++) {
                const nextEl = editorView.nodeDOM(blocks[j].pos) as HTMLElement
                if (!nextEl) break
                const nextType = blocks[j].node.attrs.elementType as string
                if (nextType !== 'parenthetical' && nextType !== 'dialogue') break
                groupBottom = yLayoutInPm(nextEl, pmRect, scale).bottom
                if (nextType === 'dialogue') {
                  endedOnDialogue = true
                  break
                }
              }
              let groupFitBottom = groupBottom + cursorOffset
              if (endedOnDialogue) {
                groupFitBottom = layoutBottomForPaginationOverflow('dialogue', groupFitBottom)
              }
              // A group taller than one full page would still overflow even starting fresh on the
              // next page — forcing the move there only delays the identical overflow by one page,
              // while compounding the risk of a larger, wrong `cursorOffset` shift (see item 2).
              // Let the generic Core Break Logic below handle the oversized dialogue block on its
              // own iteration instead (same cosmetic-overrun handling as any other oversized block).
              const groupNaturalHeight = groupBottom - naturalTop
              const oversizedGroup = groupNaturalHeight > CONTENT_HEIGHT
              if (
                !oversizedGroup &&
                layoutBottomExceedsPageContentEnd(groupFitBottom, pageContentEnd, pageContentStart)
              ) {
                // Only force the *whole* cue+dialogue group to the next page when there's no
                // meaningful room left after the cue itself. Otherwise, leave forceBreak false:
                // the cue renders normally here, and the following dialogue/parenthetical block
                // overflows on its own next iteration, where attemptBlockSplit() splits it with
                // "(MORE)" on this page and "CHARACTER (CONT'D)" + the remainder on the next —
                // matching source-PDF convention instead of stranding the whole group together.
                const roomAfterCueLines = Math.floor(
                  (pageContentEnd - blockBottom) / SCREENPLAY_LINE_HEIGHT_PX,
                )
                const usableRoomForDialogue = roomAfterCueLines - 1 // reserve 1 line for "(MORE)"
                if (usableRoomForDialogue < MIN_LINES_BEFORE_SPLIT) {
                  forceBreak = true
                }
              } else if (oversizedGroup && process.env.NODE_ENV === 'development') {
                console.warn(
                  '[PageBreakPlugin] character+dialogue group exceeds one full page and cannot be kept together',
                  { pos, preview: node.textContent.slice(0, 40) },
                )
              }
            }

            if (
              elementType === 'slugline' &&
              i < blocks.length - 1 &&
              blockTop > pageContentStart + 1
            ) {
              const slugInkBottom = layoutBottomForPaginationOverflow('slugline', blockBottom)
              if (slugInkBottom <= pageContentEnd) {
                const roomAfter = pageContentEnd - slugInkBottom
                if (Math.floor(roomAfter + 1e-6) < SCREENPLAY_LINE_HEIGHT_PX) {
                  forceBreak = true
                }
              }
            }

            // --- Core Break Logic ---
            const blockInkBottom = layoutBottomForPaginationOverflow(elementType, blockBottom)
            if (
              forceBreak ||
              (layoutBottomExceedsPageContentEnd(blockInkBottom, pageContentEnd, pageContentStart) &&
                blockTop > pageContentStart + 1)
            ) {
              // Prefer splitting the block's own text at a line boundary (matching source-PDF
              // wrapping) over moving it whole — but never when a widow/orphan check above already
              // forced a whole-*group* move (e.g. a character cue with no room for its dialogue).
              const splitResult = !forceBreak
                ? attemptBlockSplit(
                    editorView,
                    blocks,
                    i,
                    pos,
                    node,
                    elementType,
                    el,
                    naturalTop,
                    naturalBottom,
                    blockTop,
                    pageContentEnd,
                    pmRect,
                    scale,
                  )
                : null

              if (splitResult) {
                const remainder = Math.max(0, pageContentEnd - splitResult.splitLineTopPx)
                expectedGapHeights.push(remainder + WIDGET_HEIGHT)

                decorations.push(
                  Decoration.widget(
                    splitResult.splitDocPos,
                    createGapElement({
                      remainder,
                      pageNumber: screenplayPageNumForGap(coverPrefix, pageIndex),
                      more: splitResult.more,
                      contdSpeakerName: splitResult.contdSpeakerName ?? undefined,
                      inlineLeftPadPx: SPLIT_LEFT_PAD_PX[elementType],
                    }),
                    {
                      side: -1,
                      type: 'block' as const,
                      marks: [],
                      stopEvent: () => true,
                      key: `pb-split-${splitResult.splitDocPos}`,
                    },
                  ),
                )

                // Mid-text insertion has no pre-existing blank gap to subtract (unlike between-block
                // breaks, where naturalGap = naturalTop - prevBottomRaw) — text flows continuously
                // right up to the split point.
                cursorOffset += remainder + WIDGET_HEIGHT
                pageIndex++
                continue
              }

              let prevBottomRaw = pageContentStart
              let prevBottom = pageContentStart

              // Calculate exactly where the previous block ended. Drop the previous block's trailing
              // blank-line spacer so the next page starts flush — matches the CSS rule that zeroes
              // `padding-bottom` on the block before a `.page-break-gap`. Without this, the spacer
              // leaks ~16px onto the next page per break and can split a cue from its dialogue.
              if (i > 0) {
                let prevType = blocks[i - 1].node.attrs.elementType as string
                let prevEl = editorView.nodeDOM(blocks[i - 1].pos) as HTMLElement

                if (
                  (elementType === 'dialogue' || elementType === 'parenthetical') &&
                  (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue')
                ) {
                  const anchorBottom = findBreakAnchorBottom(
                    blocks,
                    i,
                    editorView,
                    pmRect,
                    scale,
                    cursorOffset,
                    pageContentStart,
                    pageContentEnd,
                  )
                  if (anchorBottom != null) {
                    prevBottomRaw = anchorBottom
                    prevBottom = prevBottomRaw + cursorOffset
                  } else if (prevEl) {
                    let bottomRaw = yLayoutInPm(prevEl, pmRect, scale).bottom
                    const hasGapNext = prevEl.nextElementSibling?.classList.contains('page-break-gap')
                    if (!hasGapNext) {
                      bottomRaw = layoutBottomForPaginationOverflow(prevType, bottomRaw)
                    }
                    prevBottomRaw = bottomRaw
                    prevBottom = prevBottomRaw + cursorOffset
                  }
                } else if (prevEl) {
                  let bottomRaw = yLayoutInPm(prevEl, pmRect, scale).bottom

                  // Prevent double-dip: if CSS `:has(+ .page-break-gap)` has already stripped the
                  // padding on this render pass, the measured bottom is already the ink bottom.
                  const hasGapNext = prevEl.nextElementSibling?.classList.contains('page-break-gap')
                  if (!hasGapNext) {
                    bottomRaw = layoutBottomForPaginationOverflow(prevType, bottomRaw)
                  }

                  prevBottomRaw = bottomRaw
                  prevBottom = prevBottomRaw + cursorOffset
                }
              }

              // Because CSS uses strictly padding, the bottom edge is absolute and never collapses
              const remainder = Math.max(0, pageContentEnd - prevBottom)
              expectedGapHeights.push(remainder + WIDGET_HEIGHT)

              decorations.push(
                Decoration.widget(
                  pos,
                  createGapElement({
                    remainder,
                    pageNumber: screenplayPageNumForGap(coverPrefix, pageIndex),
                  }),
                  {
                    side: -1,
                    /** When supported, keeps the gap out of inline/flex text flow inside `inline*` blocks. */
                    type: 'block' as const,
                    marks: [],
                    stopEvent: () => true,
                    key: `pb-${pos}`,
                  },
                ),
              )

              // The actual space between the blocks *before* our widget was injected
              const naturalGap = naturalTop - prevBottomRaw
              
              // The precise pixel shift we are introducing into the document
              const actualShift = remainder + WIDGET_HEIGHT - naturalGap
              
              cursorOffset += actualShift
              pageIndex++
            }
          }

          // `pageIndex` is incremented once per break fired above — including the forced
          // title-page → body break — so its final value already equals the number of physical
          // sheets in use (cover page counted, since it occupies a layout slot like any other
          // page). This drives `--total-pages` in Screenplay.css, which sizes `.screenplay-page`'s
          // `min-height` from a flat `total-pages * paper-height` formula with no separate term
          // for the cover sheet — subtracting the cover here would starve that formula by exactly
          // one page's height, leaving a just-started page (e.g. a lone "INT." on body page 1)
          // rendered only as tall as its content instead of a full sheet.
          const totalSheets = Math.max(1, pageIndex)

          lastExpectedGapHeights = expectedGapHeights

          return { set: DecorationSet.create(doc, decorations), totalPages: totalSheets }
        }

        /**
         * Compares the widget heights `computeDecorations()` predicted against what the browser
         * actually rendered (now that `.page-break-gap` widgets + the `:has(+ .page-break-gap)`
         * padding-zeroing CSS rules are live). A non-zero drift means the analytical projection
         * used while measuring (decorations cleared) diverged from reality — the source of
         * compounding jitter across long documents. Returns the max absolute drift in px, or
         * `Infinity` if the gap count itself doesn't match (forces a corrective pass).
         */
        function measureGapHeightDrift(): number {
          const gapEls = Array.from(editorView.dom.querySelectorAll<HTMLElement>('.page-break-gap'))
          if (gapEls.length !== lastExpectedGapHeights.length) return Infinity

          const scale = layoutScaleFromEditorDom(editorView.dom as HTMLElement)
          let maxDrift = 0
          for (let i = 0; i < gapEls.length; i++) {
            const actual = gapEls[i].getBoundingClientRect().height / scale
            const drift = Math.abs(actual - lastExpectedGapHeights[i])
            if (drift > maxDrift) maxDrift = drift
          }
          return maxDrift
        }

        function recalculate() {
          if (measuring || !editorView.dom.isConnected) return
          measuring = true

          try {
            // <PROTECTED>
            const workspace = editorView.dom.closest('.screenplay-workspace') as HTMLElement | null
            const savedScrollTop = workspace?.scrollTop ?? 0
            const savedScrollLeft = workspace?.scrollLeft ?? 0

            // Clear decorations synchronously to force raw continuous layout
            dispatchDecorations(DecorationSet.empty)
            void editorView.dom.offsetHeight // Trigger browser reflow

            const { set, totalPages } = computeDecorations()
            dispatchDecorations(set)

            const pageEl = editorView.dom.closest('.screenplay-page') as HTMLElement | null
            if (pageEl) {
              pageEl.style.setProperty('--total-pages', String(totalPages))
            }

            if (workspace) {
              workspace.scrollTop = savedScrollTop
              workspace.scrollLeft = savedScrollLeft
            }
            // </PROTECTED>
          } finally {
            measuring = false
          }
        }

        /**
         * `recalculate()` predicts break-widget heights analytically before dispatching them, so a
         * single pass can drift from what the browser actually renders once real widgets + the
         * `:has(+ .page-break-gap)` CSS rules apply. This re-measures after each pass and reruns
         * `recalculate()` (bounded to `MAX_CORRECTION_PASSES` extra passes) until the prediction
         * matches reality within `GAP_HEIGHT_EPSILON_PX`. `recalculate()` is synchronous and forces
         * its own reflow, so this converges within one JS task — no visible flicker.
         */
        function recalculateWithSelfCorrection(pass = 0) {
          recalculate()
          if (pass >= MAX_CORRECTION_PASSES) return

          const drift = measureGapHeightDrift()
          if (drift > GAP_HEIGHT_EPSILON_PX) {
            if (process.env.NODE_ENV === 'development') {
              console.debug(
                `[PageBreakPlugin] pagination drift ${drift.toFixed(2)}px exceeded epsilon — correcting (pass ${pass + 1})`,
              )
            }
            recalculateWithSelfCorrection(pass + 1)
          }
        }

        function scheduleRecalc() {
          if (timerId) clearTimeout(timerId)
          timerId = setTimeout(() => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => recalculateWithSelfCorrection())
          }, 100)
        }

        const pageEl = editorView.dom.closest('.screenplay-page')
        if (typeof ResizeObserver !== 'undefined' && pageEl) {
          resizeObserver = new ResizeObserver(() => scheduleRecalc())
          resizeObserver.observe(pageEl)
          // Node views and line wrapping can resize the inner editor without the page box changing.
          resizeObserver.observe(editorView.dom)
        }
        // `transform: scale()` does not change layout size — RO may not fire on zoom; `data-zoom` does.
        if (typeof MutationObserver !== 'undefined' && pageEl) {
          zoomAttrObserver = new MutationObserver(() => scheduleRecalc())
          zoomAttrObserver.observe(pageEl, { attributes: true, attributeFilter: ['data-zoom'] })
        }

        const onWinResize = () => scheduleRecalc()
        window.addEventListener('resize', onWinResize)

        /**
         * First pagination pass often runs before webfonts + `transform: scale(zoom)` settle on
         * refresh, so block heights differ from a moment later — dialogue drifts to page 2.
         * Re-run after fonts and again on a short timeout (matches late `data-zoom` / layout).
         */
        function recalcAfterLayoutSettled(): void {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              recalculateWithSelfCorrection()
            })
          })
        }

        scheduleRecalc()

        if (typeof document !== 'undefined') {
          if (document.fonts?.ready) {
            void document.fonts.ready.then(() => recalcAfterLayoutSettled())
          } else {
            recalcAfterLayoutSettled()
          }
          settleTimerId = setTimeout(() => {
            settleTimerId = null
            recalculateWithSelfCorrection()
          }, 500)
        }

        return {
          update(view, prevState) {
            if (measuring) return
            if (view.state.doc.eq(prevState.doc)) return
            scheduleRecalc()
          },
          destroy() {
            if (timerId) clearTimeout(timerId)
            if (settleTimerId) clearTimeout(settleTimerId)
            if (rafId) cancelAnimationFrame(rafId)
            resizeObserver?.disconnect()
            zoomAttrObserver?.disconnect()
            window.removeEventListener('resize', onWinResize)
            dispatchDecorations(DecorationSet.empty)
          },
        }
      },
    })

    return [plugin]
  },
})