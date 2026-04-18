'use client'

import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from 'prosemirror-view'

import {
  SCREENPLAY_CONTENT_HEIGHT_PX,
  SCREENPLAY_LINE_HEIGHT_PX,
} from './screenplayPaperLayout'

/* ── Layout constants ──────────────────────────────────────────────────────── */

const CONTENT_HEIGHT = SCREENPLAY_CONTENT_HEIGHT_PX
const MIN_LINES_PX = SCREENPLAY_LINE_HEIGHT_PX * 2
const WIDGET_HEIGHT = 240 // 96 top margin + 48 gap + 96 bottom margin

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

/* ── Workspace fill colour ─────────────────────────────────────────────────── */

function workspaceFillFromEl(el: Element | null): string {
  if (!el) return '#d0d0d0'
  const bg = getComputedStyle(el).backgroundColor
  return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : '#d0d0d0'
}

/* ── Widget DOM builder ────────────────────────────────────────────────────── */

interface GapOpts {
  remainder: number
  pageNumber: number
  workspaceBg: string
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
  gap.style.backgroundColor = opts.workspaceBg

  const topMargin = document.createElement('div')
  topMargin.className = 'page-break-gap__top-margin'

  if (opts.pageNumber >= 2) {
    const num = document.createElement('span')
    num.className = 'page-break-gap__page-number'
    num.textContent = `${opts.pageNumber}.`
    topMargin.appendChild(num)
  }

  wrapper.append(rem, botMargin, gap, topMargin)
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
          if (tr.docChanged) return DecorationSet.empty
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
        let measuring = false

        function dispatchDecorations(set: DecorationSet) {
          const tr = editorView.state.tr.setMeta(pageBreakKey, { decorations: set })
          editorView.dispatch(tr)
        }

        function computeDecorations(): DecorationSet {
          const state = editorView.state
          const doc = state.doc
          const workspace = editorView.dom.closest('.screenplay-workspace')
          const workspaceBg = workspaceFillFromEl(workspace)

          const blocks = collectScriptBlocks(doc)
          if (blocks.length === 0) return DecorationSet.empty

          const decorations: Decoration[] = []
          const pmRect = editorView.dom.getBoundingClientRect()

          let cursorOffset = 0
          let pageIndex = 1

          for (let i = 0; i < blocks.length; i++) {
            const { pos, node } = blocks[i]
            const el = editorView.nodeDOM(pos) as HTMLElement
            if (!el) continue

            const cs = getComputedStyle(el)
            const mt = parseFloat(cs.marginTop) || 0
            const mb = parseFloat(cs.marginBottom) || 0

            const rect = el.getBoundingClientRect()
            
            // Raw physical positions relative to the ProseMirror container
            const naturalTop = rect.top - pmRect.top
            const naturalBottom = rect.bottom - pmRect.top

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
                groupBottom = nextEl.getBoundingClientRect().bottom - pmRect.top
                if (nextType === 'dialogue') break
              }
              if (groupBottom + cursorOffset > pageContentEnd) forceBreak = true
            }

            if (elementType === 'parenthetical' && blockBottom <= pageContentEnd && blockTop > pageContentStart + 1) {
              const nextBlock = blocks[i + 1]
              if (nextBlock && nextBlock.node.attrs.elementType === 'dialogue') {
                const nextEl = editorView.nodeDOM(nextBlock.pos) as HTMLElement
                if (nextEl) {
                  const nextBottom = nextEl.getBoundingClientRect().bottom - pmRect.top + cursorOffset
                  if (nextBottom > pageContentEnd) forceBreak = true
                }
              }
            }

            if (elementType === 'slugline' && blockBottom <= pageContentEnd && blockTop > pageContentStart + 1) {
              if (pageContentEnd - blockBottom < MIN_LINES_PX) forceBreak = true
            }

            // --- Core Break Logic ---
            // If it crosses the page boundary (and isn't the very first item on the page), push it.
            if (forceBreak || (blockBottom > pageContentEnd && blockTop > pageContentStart + 1)) {
              
              // Find exactly where the previous block's margin ended
              const prevEl = i > 0 ? editorView.nodeDOM(blocks[i - 1].pos) as HTMLElement : null
              let prevBottom = pageContentStart
              let prevMb = 0
              if (prevEl) {
                prevBottom = prevEl.getBoundingClientRect().bottom - pmRect.top + cursorOffset
                prevMb = parseFloat(getComputedStyle(prevEl).marginBottom) || 0
              }

              // Pad perfectly to the end of the 861px page content area
              const remainder = Math.max(0, pageContentEnd - prevBottom - prevMb)

              decorations.push(
                Decoration.widget(
                  pos,
                  createGapElement({
                    remainder,
                    pageNumber: pageIndex + 1,
                    workspaceBg,
                  }),
                  {
                    side: -1,
                    marks: [],
                    stopEvent: () => true,
                    key: `pb-${pos}`,
                  },
                ),
              )

              // Account for the injected widget height PLUS the margin collapsing shift.
              // CSS rule `.page-break-gap + .script-block` strips the top margin of the pushed block.
              cursorOffset += prevMb + remainder + WIDGET_HEIGHT - Math.max(prevMb, mt)
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
            window.removeEventListener('resize', onWinResize)
            dispatchDecorations(DecorationSet.empty)
          },
        }
      },
    })

    return [plugin]
  },
})