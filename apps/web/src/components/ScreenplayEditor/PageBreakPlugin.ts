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
                forceBreak = true
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

          const totalPagesBody = Math.max(1, coverPrefix ? pageIndex - 1 : pageIndex)

          lastExpectedGapHeights = expectedGapHeights

          return { set: DecorationSet.create(doc, decorations), totalPages: totalPagesBody }
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
          settleTimerId = window.setTimeout(() => {
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