'use client'

import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from 'prosemirror-view'

import {
  SCREENPLAY_CONTENT_HEIGHT_PX,
  SCREENPLAY_INTER_PAGE_GAP_PX,
  SCREENPLAY_LINE_HEIGHT_PX,
  SCREENPLAY_MARGIN_BOTTOM_PX,
  SCREENPLAY_MARGIN_TOP_PX,
} from './screenplayPaperLayout'

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
 * Block bottoms from getBoundingClientRect()/scale are fractional. Comparing to the integer
 * content band (864px × N) without rounding can push the last line of a page onto the next,
 * even when the layout still fits within the industry line grid in practice.
 *
 * Slight (+2px) headroom absorbs residual sub-pixel error from zoom + font metrics without
 * changing the nominal 54 × 16px page frame.
 */
function layoutBottomExceedsPageContentEnd(layoutBottom: number, pageContentEnd: number): boolean {
  return Math.floor(layoutBottom + 1e-6) > Math.floor(pageContentEnd + 2)
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

/* ── Widget DOM builder ────────────────────────────────────────────────────── */

interface GapOpts {
  remainder: number
  pageNumber: number
}

function createGapElement(opts: GapOpts): HTMLElement {
  // <PROTECTED>
  const wrapper = document.createElement('div')
  wrapper.className = 'page-break-gap'
  wrapper.contentEditable = 'false'

  const rem = document.createElement('div')
  rem.className = 'page-break-gap__remainder'
  rem.style.height = `${Math.max(0, opts.remainder)}px`

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
              const prevEntry = blocks[i - 1]
              const prevEl = editorView.nodeDOM(prevEntry.pos) as HTMLElement
              let prevBottomRaw = 0
              let prevBottom = 0
              if (prevEl) {
                prevBottomRaw = yLayoutInPm(prevEl, pmRect, scale).bottom
                prevBottom = prevBottomRaw + cursorOffset
              }

              // Use current pageIndex so the remainder is correct even if the
              // title-page content overflowed past page 1.
              const titlePageEnd = (pageIndex - 1) * (CONTENT_HEIGHT + WIDGET_HEIGHT) + CONTENT_HEIGHT
              const remainder = Math.max(0, titlePageEnd - prevBottom)

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
            if (elementType === 'character' && blockBottom <= pageContentEnd && blockTop > pageContentStart + 1) {
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
              if (layoutBottomExceedsPageContentEnd(groupFitBottom, pageContentEnd)) {
                forceBreak = true
              }
            }

            if (elementType === 'parenthetical' && blockBottom <= pageContentEnd && blockTop > pageContentStart + 1) {
              const nextBlock = blocks[i + 1]
              if (nextBlock && nextBlock.node.attrs.elementType === 'dialogue') {
                const nextEl = editorView.nodeDOM(nextBlock.pos) as HTMLElement
                if (nextEl) {
                  const nextBottom = yLayoutInPm(nextEl, pmRect, scale).bottom + cursorOffset
                  const nextFitBottom = layoutBottomForPaginationOverflow('dialogue', nextBottom)
                  if (layoutBottomExceedsPageContentEnd(nextFitBottom, pageContentEnd)) forceBreak = true
                }
              }
            }

            if (
              elementType === 'slugline' &&
              i < blocks.length - 1 &&
              blockBottom <= pageContentEnd &&
              blockTop > pageContentStart + 1
            ) {
              const roomAfter = pageContentEnd - blockBottom
              if (Math.floor(roomAfter + 1e-6) < SCREENPLAY_LINE_HEIGHT_PX) {
                forceBreak = true
              }
            }

            // --- Core Break Logic ---
            const blockInkBottom = layoutBottomForPaginationOverflow(elementType, blockBottom)
            if (
              forceBreak ||
              (layoutBottomExceedsPageContentEnd(blockInkBottom, pageContentEnd) &&
                blockTop > pageContentStart + 1)
            ) {
              
              let prevBottomRaw = pageContentStart
              let prevBottom = pageContentStart

              // Calculate exactly where the previous block ended
              if (i > 0) {
                const prevEl = editorView.nodeDOM(blocks[i - 1].pos) as HTMLElement
                if (prevEl) {
                  prevBottomRaw = yLayoutInPm(prevEl, pmRect, scale).bottom
                  prevBottom = prevBottomRaw + cursorOffset
                }
              }

              // Because CSS uses strictly padding, the bottom edge is absolute and never collapses
              const remainder = Math.max(0, pageContentEnd - prevBottom)

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

          const totalPagesBody = Math.max(1, coverPrefix ? pageIndex - 1 : pageIndex)

          return { set: DecorationSet.create(doc, decorations), totalPages: totalPagesBody }
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

        function scheduleRecalc() {
          if (timerId) clearTimeout(timerId)
          timerId = setTimeout(() => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(recalculate)
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
              recalculate()
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
          settleTimerId = window.setTimeout(() => {
            settleTimerId = null
            recalculate()
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