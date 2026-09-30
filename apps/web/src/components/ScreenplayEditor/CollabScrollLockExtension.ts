'use client'

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import {
  ySyncPluginKey,
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from '@tiptap/y-tiptap'

/**
 * Keeps a cowriter's viewport still while someone else types.
 *
 * Two separate things move a reader who isn't touching their keyboard, and this handles both:
 *
 * 1. **y-tiptap scrolls to the local caret on every remote change.** `ProsemirrorBinding
 *    ._typeChanged` ends with `tr.scrollIntoView()` whenever the local cursor happens to be on
 *    screen — and it always is here, because the reading-position restore parks the caret on the
 *    first visible block. So every keystroke from the other writer re-aims the non-typing reader's
 *    viewport at their own caret. `handleScrollToSelection` below refuses that scroll for
 *    remote-origin transactions only; the local writer's own edits, and their undo/redo, still
 *    scroll normally.
 *
 * 2. **Text inserted above the viewport pushes everything down.** `scrollTop` is an offset from the
 *    top of the document, so it means something different the moment the document grows above it.
 *    A cowriter writing on page 5 slides a reader on page 50 down by a line per wrap and by a whole
 *    sheet per repagination. The lock pins a Yjs *relative* position — the doc position at the top
 *    of the viewport — and re-asserts `scrollTop` against it for a short window after each remote
 *    change, through the pagination passes that follow, so the reader's page stays under their eyes.
 *
 * Nothing here is shared between clients: the anchor is per-view and never leaves the browser, so
 * two writers hold two independent positions in the same document by construction.
 */

/** How long after a remote change to keep re-asserting the anchor, in ms. */
const HOLD_MS = 900

/**
 * Below this the correction isn't worth a scroll write.
 *
 * Sub-pixel drift is the norm — `coordsAtPos` reports fractional positions off a `scale()`d page —
 * and writing `scrollTop` every frame for it would fight the browser's own rounding.
 */
const TOLERANCE_PX = 1

/**
 * Probe depths for the anchor hit test, in px below the viewport's top edge.
 *
 * The top edge often lands in a page-break gap, which is a widget decoration with no document
 * position behind it, so the first probe comes back empty. Walking down finds the first real block.
 */
const ANCHOR_PROBE_OFFSETS_PX = [1, 24, 72, 160, 320]

/** A local scroll, tap or keystroke outranks the lock — the reader has taken over. */
const INTENT_EVENTS = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const

const collabScrollLockKey = new PluginKey<{ remote: boolean }>('collabScrollLock')

/** The shape of `ySyncPluginKey`'s state that this plugin reads; y-tiptap types it as `any`. */
interface YSyncState {
  type: unknown
  doc: unknown
  binding: { mapping: unknown } | null
}

function ySyncState(view: EditorView): YSyncState | null {
  const state = ySyncPluginKey.getState(view.state) as YSyncState | undefined
  if (!state || !state.type || !state.doc || !state.binding) return null
  return state
}

/** A remembered viewport top: where it is in the Yjs document, and how far below the fold it sits. */
interface Anchor {
  /** Yjs relative position — survives the full-document replace every remote change applies. */
  rel: unknown
  /** `coordsAtPos(pos).top` minus the workspace's top edge, at capture time. */
  offsetPx: number
  /**
   * Rendered width of the ProseMirror column when the offset was taken.
   *
   * The offset is in visual px, and the page is drawn under `transform: scale(zoom)`, so a zoom
   * change mid-hold would make it mean a different distance down the paper. Width is the cheapest
   * proxy for that scale, and a mismatch retires the anchor rather than acting on it.
   */
  columnWidthPx: number
}

class ViewportLock {
  private readonly view: EditorView
  private readonly isArmed: () => boolean
  private readonly workspace: HTMLElement | null
  private anchor: Anchor | null = null
  /** Epoch ms until which the anchor is re-asserted every frame; 0 when the reader is in control. */
  private holdUntil = 0
  private holdRafId: number | null = null
  private captureRafId: number | null = null

  constructor(view: EditorView, isArmed: () => boolean) {
    this.view = view
    this.isArmed = isArmed
    this.workspace = view.dom.closest('.screenplay-workspace') as HTMLElement | null
    if (this.workspace) {
      for (const type of INTENT_EVENTS) {
        this.workspace.addEventListener(type, this.onUserIntent, { passive: true })
      }
      this.workspace.addEventListener('scroll', this.onScroll, { passive: true })
    }
  }

  update(view: EditorView, docChanged: boolean): void {
    if (!this.workspace || !this.isArmed()) {
      this.releaseHold()
      return
    }
    const remote = collabScrollLockKey.getState(view.state)?.remote === true

    if (docChanged && remote) {
      // Hold what was already measured. Re-capturing now would read the post-change DOM and pin
      // the reader to wherever the remote edit just pushed them.
      if (this.anchor) this.startHold()
      // Nothing measured yet — the very first remote change after arming. Take a reading off the
      // settled DOM so the next one has something to hold against.
      else this.scheduleCapture()
      return
    }
    if (docChanged) {
      // A local edit: the caret is the reader's own, and ProseMirror is free to follow it.
      this.releaseHold()
    }
    if (this.holdUntil === 0) this.scheduleCapture()
  }

  destroy(): void {
    this.releaseHold()
    if (this.captureRafId != null) cancelAnimationFrame(this.captureRafId)
    this.captureRafId = null
    if (!this.workspace) return
    for (const type of INTENT_EVENTS) {
      this.workspace.removeEventListener(type, this.onUserIntent)
    }
    this.workspace.removeEventListener('scroll', this.onScroll)
  }

  private onUserIntent = (): void => {
    this.releaseHold()
    this.scheduleCapture()
  }

  /**
   * Scroll fires both for the reader and for this lock's own writes. During a hold the writes are
   * ours, so re-capturing would pin the anchor to the correction in flight rather than to the page
   * the reader was on — hence the `holdUntil` guard rather than a flag around the assignment,
   * which the event outlives.
   */
  private onScroll = (): void => {
    if (this.holdUntil !== 0) return
    this.scheduleCapture()
  }

  private scheduleCapture(): void {
    if (this.captureRafId != null) return
    this.captureRafId = requestAnimationFrame(() => {
      this.captureRafId = null
      if (this.holdUntil !== 0) return
      this.capture()
    })
  }

  /** Records the document position currently sitting at the top of the workspace. */
  private capture(): void {
    const workspace = this.workspace
    if (!workspace || this.view.isDestroyed) return
    const sync = ySyncState(this.view)
    if (!sync) return

    const wsRect = workspace.getBoundingClientRect()
    const pmRect = this.view.dom.getBoundingClientRect()
    if (pmRect.width <= 0) return
    const left = pmRect.left + pmRect.width / 2

    for (const probe of ANCHOR_PROBE_OFFSETS_PX) {
      const top = wsRect.top + probe
      if (top > wsRect.bottom) break
      const hit = this.view.posAtCoords({ left, top })
      if (!hit) continue
      // `pos` rather than `inside`: a character-level anchor keeps the same word at the top of the
      // viewport when the other writer edits earlier in the very block the reader is looking at,
      // where a block-start anchor would let the text reflow underneath them.
      const pos = hit.pos
      if (pos < 0 || pos > this.view.state.doc.content.size) continue
      let coordsTop: number
      try {
        coordsTop = this.view.coordsAtPos(pos).top
      } catch {
        continue
      }
      const rel = absolutePositionToRelativePosition(
        pos,
        sync.type as never,
        sync.binding!.mapping as never,
      )
      if (!rel) continue
      this.anchor = {
        rel,
        offsetPx: coordsTop - wsRect.top,
        columnWidthPx: pmRect.width,
      }
      return
    }
  }

  private startHold(): void {
    this.holdUntil = Date.now() + HOLD_MS
    if (this.holdRafId != null) return
    // Correct once synchronously, before the browser paints the shifted frame.
    this.reassert()
    // `reassert` retires the anchor when the paper's scale changed under it, which ends the hold.
    if (this.holdUntil !== 0) this.holdRafId = requestAnimationFrame(this.tick)
  }

  private releaseHold(): void {
    this.holdUntil = 0
    if (this.holdRafId != null) cancelAnimationFrame(this.holdRafId)
    this.holdRafId = null
  }

  /**
   * Repagination runs on its own schedule after a remote change — a 100ms timeout, a rAF, self
   * correcting passes, and a 500ms settle — and each pass moves every page boundary below the edit.
   * Re-asserting for a whole frame window rides all of them out instead of guessing their timing.
   */
  private tick = (): void => {
    this.holdRafId = null
    if (Date.now() >= this.holdUntil) {
      this.holdUntil = 0
      return
    }
    this.reassert()
    if (this.holdUntil !== 0) this.holdRafId = requestAnimationFrame(this.tick)
  }

  /** Puts the anchored document position back under the top of the workspace. */
  private reassert(): void {
    const workspace = this.workspace
    const anchor = this.anchor
    if (!workspace || !anchor || this.view.isDestroyed) return
    const sync = ySyncState(this.view)
    if (!sync) return

    if (Math.abs(this.view.dom.getBoundingClientRect().width - anchor.columnWidthPx) > 0.5) {
      // The reader zoomed, or the column reflowed, since this was measured. The stored offset no
      // longer describes the same place on the paper, so drop it and let the next capture win.
      this.anchor = null
      this.releaseHold()
      return
    }

    const pos = relativePositionToAbsolutePosition(
      sync.doc as never,
      sync.type as never,
      anchor.rel as never,
      sync.binding!.mapping as never,
    )
    // Null means the anchored content was deleted by the other writer. There is nothing left to
    // hold the reader against, so leave the scroll alone rather than guessing at a nearby position.
    if (pos == null || pos < 0 || pos > this.view.state.doc.content.size) return

    let coordsTop: number
    try {
      coordsTop = this.view.coordsAtPos(pos).top
    } catch {
      return
    }
    const delta = coordsTop - workspace.getBoundingClientRect().top - anchor.offsetPx
    if (!Number.isFinite(delta) || Math.abs(delta) < TOLERANCE_PX) return
    workspace.scrollTop += delta
  }
}

export interface CollabScrollLockOptions {
  /**
   * False until the reading-position restore has finished steering the scroll on load.
   *
   * The initial Yjs sync arrives as one enormous remote change, and holding an anchor captured
   * before it would pin the reader to page one for the rest of the session. A ref rather than a
   * value because extensions are built once, on the first render.
   */
  armedRef: { current: boolean } | null
}

export const CollabScrollLock = Extension.create<CollabScrollLockOptions>({
  name: 'collabScrollLock',

  addOptions() {
    return { armedRef: null }
  },

  addProseMirrorPlugins() {
    const armedRef = this.options.armedRef
    const isArmed = () => armedRef?.current === true

    return [
      new Plugin<{ remote: boolean }>({
        key: collabScrollLockKey,
        state: {
          init: () => ({ remote: false }),
          apply: (tr, value) => {
            /**
             * Read straight off the transaction rather than out of `ySyncPluginKey`'s state, so
             * this never depends on which of the two plugins the editor applies first.
             * `isUndoRedoOperation` rides the same meta and is a *local* action — the writer hit
             * undo — so it is deliberately not treated as remote.
             */
            const change = tr.getMeta(ySyncPluginKey) as
              | { isChangeOrigin?: boolean; isUndoRedoOperation?: boolean }
              | undefined
            const remote =
              change !== undefined && !!change.isChangeOrigin && !change.isUndoRedoOperation
            return remote === value.remote ? value : { remote }
          },
        },
        props: {
          /**
           * Returning true tells ProseMirror the scroll has been handled, which is how the
           * `tr.scrollIntoView()` that y-tiptap attaches to every remote change is dropped.
           */
          handleScrollToSelection: (view) =>
            collabScrollLockKey.getState(view.state)?.remote === true,
        },
        view: (view) => {
          const lock = new ViewportLock(view, isArmed)
          return {
            update(updatedView, prevState) {
              lock.update(updatedView, !updatedView.state.doc.eq(prevState.doc))
            },
            destroy: () => lock.destroy(),
          }
        },
      }),
    ]
  },
})
