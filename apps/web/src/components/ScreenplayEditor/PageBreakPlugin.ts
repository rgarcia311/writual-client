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

/* ── Layout constants ──────────────────────────────────────────────────────── */

const CONTENT_HEIGHT = SCREENPLAY_CONTENT_HEIGHT_PX
const MIN_LINES_PX = SCREENPLAY_LINE_HEIGHT_PX * 2
/** Bottom margin band + inter-page gap + top margin band (see PageBreakPlugin DOM). */
const WIDGET_HEIGHT =
  SCREENPLAY_MARGIN_BOTTOM_PX + SCREENPLAY_INTER_PAGE_GAP_PX + SCREENPLAY_MARGIN_TOP_PX

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
        let resizeObserver: ResizeObserver | null = null
        let zoomAttrObserver: MutationObserver | null = null
        let measuring = false

        function dispatchDecorations(set: DecorationSet) {
          const tr = editorView.state.tr.setMeta(pageBreakKey, { decorations: set })
          editorView.dispatch(tr)
        }

        function computeDecorations(): DecorationSet {
          const state = editorView.state
          const doc = state.doc
          const blocks = collectScriptBlocks(doc)
          if (blocks.length === 0) return DecorationSet.empty

          const decorations: Decoration[] = []
          const pmRect = editorView.dom.getBoundingClientRect()
          const scale = layoutScaleFromEditorDom(editorView.dom as HTMLElement)

          let cursorOffset = 0
          let pageIndex = 1

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

            // --- Orphan / Widow Group Checks ---
            if (elementType === 'character' && blockBottom <= pageContentEnd && blockTop > pageContentStart + 1) {
              let groupBottom = naturalBottom
              for (let j = i + 1; j < blocks.length; j++) {
                const nextEl = editorView.nodeDOM(blocks[j].pos) as HTMLElement
                if (!nextEl) break
                const nextType = blocks[j].node.attrs.elementType as string
                if (nextType !== 'parenthetical' && nextType !== 'dialogue') break
                groupBottom = yLayoutInPm(nextEl, pmRect, scale).bottom
                if (nextType === 'dialogue') break
              }
              if (groupBottom + cursorOffset > pageContentEnd) forceBreak = true
            }

            if (elementType === 'parenthetical' && blockBottom <= pageContentEnd && blockTop > pageContentStart + 1) {
              const nextBlock = blocks[i + 1]
              if (nextBlock && nextBlock.node.attrs.elementType === 'dialogue') {
                const nextEl = editorView.nodeDOM(nextBlock.pos) as HTMLElement
                if (nextEl) {
                  const nextBottom = yLayoutInPm(nextEl, pmRect, scale).bottom + cursorOffset
                  if (nextBottom > pageContentEnd) forceBreak = true
                }
              }
            }

            if (elementType === 'slugline' && blockBottom <= pageContentEnd && blockTop > pageContentStart + 1) {
              if (pageContentEnd - blockBottom < MIN_LINES_PX) forceBreak = true
            }

            // --- Core Break Logic ---
            if (forceBreak || (blockBottom > pageContentEnd && blockTop > pageContentStart + 1)) {
              
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
                    pageNumber: pageIndex + 1,
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

          return DecorationSet.create(doc, decorations)
        }

        function recalculate() {
          if (measuring || !editorView.dom.isConnected) return
          measuring = true

          try {
            const workspace = editorView.dom.closest('.screenplay-workspace') as HTMLElement | null
            const savedScrollTop = workspace?.scrollTop ?? 0
            const savedScrollLeft = workspace?.scrollLeft ?? 0

            // Clear decorations synchronously to force raw continuous layout
            dispatchDecorations(DecorationSet.empty)
            void editorView.dom.offsetHeight // Trigger browser reflow

            const decos = computeDecorations()
            dispatchDecorations(decos)

            if (workspace) {
              workspace.scrollTop = savedScrollTop
              workspace.scrollLeft = savedScrollLeft
            }
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

        if (typeof document !== 'undefined' && document.fonts?.ready) {
          void document.fonts.ready.then(() => scheduleRecalc())
        }

        scheduleRecalc()

        return {
          update(view, prevState) {
            if (measuring) return
            if (view.state.doc.eq(prevState.doc)) return
            scheduleRecalc()
          },
          destroy() {
            if (timerId) clearTimeout(timerId)
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