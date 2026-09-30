'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { Selection } from '@tiptap/pm/state'
import {
  bodyPageFromSheet,
  columnYFromPageAnchor,
  pageAnchorFromColumnY,
} from '@/components/ScreenplayEditor/screenplayPageGeometry'
import {
  readScreenplayReadingPosition,
  rememberScreenplayReadingPosition,
  type ScreenplayReadingPosition,
} from '@/state/screenplayReadingPosition'
import { peekScreenplaySnapshot, readScreenplaySnapshot } from '@/lib/screenplaySnapshotCache'
import {
  readScreenplayPaginationSheetTotal,
  screenplayDomHasCoverTitlePage,
} from '../utils/screenplayPaginationRead'

/** Idle gap before a scroll is written through to localStorage. */
const RECORD_DEBOUNCE_MS = 400

/** Gap between restore attempts while the paginated stack is still settling under us. */
const RESTORE_POLL_MS = 100

/** How long to keep trying to reach the stored page before giving up on it. */
const RESTORE_DEADLINE_MS = 6000

/**
 * How long the sheet total must hold still before the layout counts as settled.
 *
 * PageBreakPlugin's last scheduled pass runs at 500ms, and every pass clears its decorations to
 * force a continuous relayout before recomputing — which collapses the document's height, lets the
 * browser clamp `scrollTop`, and then puts the offset back. Landing on the stored page has to
 * outlast that, or a pass arriving after the restore leaves the reader somewhere else.
 */
const TOTAL_SETTLE_MS = 600

/** Layout px within which the viewport counts as being on the stored page. */
const RESTORE_TOLERANCE_PX = 2

/** Slack on top of the restore loop's own deadline before the safety net below fires. */
const RESTORE_SAFETY_GRACE_MS = 1000

/**
 * Where the restore has got to, and therefore whether recording is allowed.
 *
 * `restoring` blocks all writes. This matters more than it looks: the scrollable height of the
 * workspace comes from an inline height on the stage that a ResizeObserver sets from the page's
 * measured height, so for the first frames after pagination reports a total the container is still
 * short and `scrollTop` clamps to the top. Recording during that window would overwrite a perfectly
 * good "page 47" with "page 1" — and since the next visit then restores page 1, the reader's real
 * position is gone for good. A restore that never lands leaves `blocked` instead, which keeps the
 * stored page untouched until the reader scrolls somewhere themselves.
 */
type RestorePhase = 'restoring' | 'live' | 'blocked'

/** What the restore loop is trying to reach. */
type RestoreTarget =
  | { kind: 'anchor'; anchor: ScreenplayReadingPosition }
  /** A pre-page-tracking snapshot entry, which only ever held a raw offset. */
  | { kind: 'offset'; scrollTopLayoutPx: number }

export interface ScreenplayReadingPositionStatus {
  /**
   * True once the restore has stopped steering the scroll — it reached the stored page, gave up, or
   * had nothing to reach. The load curtain waits on this so the reader never watches the editor sit
   * on page one for a moment and then jump.
   */
  restoreSettled: boolean
}

export interface UseScreenplayReadingPositionOpts {
  /** `${projectId}:${documentId}` — the same key the paint cache is stored under. */
  storageKey: string | undefined
  /** The `.screenplay-workspace` scroll container. */
  workspaceRef: React.RefObject<HTMLElement | null>
  /** The `.screenplay-page` pagination root. */
  pageRef: React.RefObject<HTMLElement | null>
  /** False until PageBreakPlugin has laid the sheets out; before that there are no pages to be on. */
  paginationReady: boolean
  editor: Editor | null
  /**
   * Set true once this hook has stopped steering the scroll, however that ended. The paint cache
   * waits on it so it can never cache the pages the restore was passing through.
   */
  restoreSettledRef: React.RefObject<boolean>
}

interface Measurement {
  sheet: number
  ratio: number
  totalSheets: number
  scrollTopLayoutPx: number
  /** Visual-to-layout scale of the paper, re-derived rather than trusted from the stored zoom. */
  scale: number
  /** Layout-space y of the viewport's top edge within the ProseMirror column. */
  columnY: number
}

/**
 * Reads which sheet the reader is currently looking at, straight from the paginated DOM.
 *
 * Returns null while the document is not laid out, so a half-measured position can never overwrite
 * a good one. The body page is deliberately not derived here: it needs a scan of every script block
 * to find the cover prefix, and the restore loop calls this twice a tick without ever wanting it.
 */
function measure(workspaceEl: HTMLElement, pageEl: HTMLElement): Measurement | null {
  if (!workspaceEl.isConnected || !pageEl.isConnected) return null
  const pmEl = pageEl.querySelector<HTMLElement>('.ProseMirror')
  if (!pmEl || pmEl.offsetWidth <= 0) return null

  const pmRect = pmEl.getBoundingClientRect()
  const scale = pmRect.width / pmEl.offsetWidth
  if (!Number.isFinite(scale) || scale <= 0) return null

  const columnY = (workspaceEl.getBoundingClientRect().top - pmRect.top) / scale
  const totalSheets = readScreenplayPaginationSheetTotal(pageEl) ?? 0
  const { sheet, ratio } = pageAnchorFromColumnY(columnY, totalSheets)

  return {
    sheet,
    ratio,
    totalSheets,
    scrollTopLayoutPx: workspaceEl.scrollTop / scale,
    scale,
    columnY,
  }
}

/**
 * Layout-space `scrollTop` that would put `columnY` at the viewport's top edge.
 *
 * The gap between the scroll box's origin and the ProseMirror column's is a constant (stage
 * padding, the page's own top margin), so it can be recovered from any single measurement rather
 * than hard-coded here — which keeps this correct if the stage's insets ever change.
 */
function scrollTopLayoutForColumnY(m: Measurement, columnY: number): number {
  return m.scrollTopLayoutPx - m.columnY + columnY
}

/**
 * Remembers the page the reader is on, and puts them back on it when they return.
 *
 * The position is recorded to localStorage (see `screenplayReadingPosition.ts`) rather than to the
 * IndexedDB paint cache so that it is readable synchronously on the next mount. The script body
 * itself comes from the local content cache and the server refetch continues in the background —
 * neither moves the scroll position, so the page restored here is where the reader stays while the
 * rest of the document arrives.
 */
export function useScreenplayReadingPosition(
  opts: UseScreenplayReadingPositionOpts,
): ScreenplayReadingPositionStatus {
  const { storageKey, workspaceRef, pageRef, paginationReady, editor, restoreSettledRef } = opts
  const phaseRef = React.useRef<RestorePhase>('restoring')
  /** The restore is one-shot per document; this keeps a re-run of the effect from re-arming it. */
  const startedRef = React.useRef(false)
  /**
   * Drives the load curtain. Flipped as soon as the reader is *first* on the right page, which is
   * earlier than `restoreSettledRef`: that one waits out the settle hold before the paint cache may
   * write, but keeping the curtain up for that whole hold just leaves the reader staring at a
   * static copy of a page the live editor is already showing.
   */
  const [restoreSettled, setRestoreSettled] = React.useState(false)

  React.useEffect(() => {
    phaseRef.current = 'restoring'
    startedRef.current = false
    restoreSettledRef.current = false
    setRestoreSettled(false)
  }, [storageKey, restoreSettledRef])

  // ── Restore: keep trying until the reader is actually on the stored page ──
  React.useEffect(() => {
    if (!paginationReady || !storageKey || startedRef.current) return
    const workspaceEl = workspaceRef.current
    const pageEl = pageRef.current
    if (!workspaceEl || !pageEl) return

    startedRef.current = true
    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | null = null
    let reachedAt: number | null = null

    const clearTimer = () => {
      if (timerId != null) {
        clearTimeout(timerId)
        timerId = null
      }
    }

    /**
     * Hand control back to the reader: stop steering, start recording, release the paint cache.
     * Also uncovers the editor for the paths that never landed on a page — there is nothing left
     * to wait for, so the curtain must not outlive the attempt.
     */
    const goLive = () => {
      clearTimer()
      if (cancelled || phaseRef.current === 'live') return
      phaseRef.current = 'live'
      restoreSettledRef.current = true
      setRestoreSettled(true)
    }

    /**
     * The reader took over. Their scroll outranks anything stored, so stop steering immediately —
     * and go live, because a position they chose by hand is one worth recording.
     */
    const intentEvents = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const
    const onUserIntent = () => goLive()
    for (const type of intentEvents) {
      workspaceEl.addEventListener(type, onUserIntent, { passive: true })
    }
    const removeIntentListeners = () => {
      for (const type of intentEvents) workspaceEl.removeEventListener(type, onUserIntent)
    }

    const runLoop = (target: RestoreTarget) => {
      if (cancelled || phaseRef.current !== 'restoring') return
      const deadline = Date.now() + RESTORE_DEADLINE_MS
      let lastTotal = -1
      let totalStableSince = Date.now()

      const attempt = () => {
        timerId = null
        if (cancelled || phaseRef.current !== 'restoring') return

        const m = measure(workspaceEl, pageEl)
        if (m) {
          if (m.totalSheets !== lastTotal) {
            lastTotal = m.totalSheets
            totalStableSince = Date.now()
          }
          const settled = Date.now() - totalStableSince >= TOTAL_SETTLE_MS

          /**
           * A total still below the stored page means pagination has not caught up yet — clamping
           * to it would drop the reader at the end of a document that is still growing. Wait for
           * the total to reach the page, or for it to stop changing (the document really did get
           * shorter), before trusting it.
           */
          const totalUsable =
            target.kind === 'offset' || m.totalSheets >= target.anchor.sheet || settled

          if (totalUsable) {
            const targetScrollTop =
              target.kind === 'offset'
                ? target.scrollTopLayoutPx
                : scrollTopLayoutForColumnY(
                    m,
                    columnYFromPageAnchor(target.anchor, m.totalSheets),
                  )

            let onTarget = Math.abs(m.scrollTopLayoutPx - targetScrollTop) <= RESTORE_TOLERANCE_PX
            if (!onTarget) {
              // Assigning past the current scroll range clamps, which is exactly the case this
              // loop exists to outlast — so re-read rather than assuming the assignment took.
              workspaceEl.scrollTop = targetScrollTop * m.scale
              const after = measure(workspaceEl, pageEl)
              onTarget =
                after != null &&
                Math.abs(after.scrollTopLayoutPx - targetScrollTop) <= RESTORE_TOLERANCE_PX
            }

            if (!onTarget) {
              reachedAt = null
            } else {
              if (reachedAt == null) {
                reachedAt = Date.now()
                // On the page at last — uncover the live editor. The loop keeps watching from
                // underneath, so a later pagination pass that nudges the scroll is corrected
                // within a tick rather than being left for the reader to notice.
                placeCaretOnScreen(editor, workspaceEl, pageEl)
                setRestoreSettled(true)
              }
              // Hold the page until the layout has stopped moving, so a later pagination pass
              // cannot knock the reader off it after this loop has stood down.
              if (settled && Date.now() - reachedAt >= TOTAL_SETTLE_MS) {
                goLive()
                return
              }
            }
          }
        }

        if (Date.now() >= deadline) {
          clearTimer()
          if (reachedAt != null) {
            goLive()
          } else {
            // Never got there. Leave the stored page alone rather than overwriting it with
            // wherever the document happened to stop. The paint cache is released anyway — a
            // snapshot of the wrong pages only costs one stale curtain, and holding it back
            // forever would leave an older, wronger one in its place.
            phaseRef.current = 'blocked'
            restoreSettledRef.current = true
            setRestoreSettled(true)
          }
          return
        }
        timerId = setTimeout(attempt, RESTORE_POLL_MS)
      }

      attempt()
    }

    const stored = readScreenplayReadingPosition(storageKey)
    if (stored) {
      runLoop({ kind: 'anchor', anchor: stored })
    } else {
      /**
       * Nothing recorded for this document — a first visit, or an entry written before pages were
       * tracked. The paint cache still carries the raw offset it was captured at, so fall back to
       * that rather than dropping the reader at the top.
       */
      const memo = peekScreenplaySnapshot(storageKey)
      if (memo) {
        runLoop({ kind: 'offset', scrollTopLayoutPx: memo.scrollTopLayoutPx })
      } else {
        void readScreenplaySnapshot(storageKey).then((snap) => {
          if (cancelled) return
          if (snap) runLoop({ kind: 'offset', scrollTopLayoutPx: snap.scrollTopLayoutPx })
          // With nothing stored anywhere there is no position to protect, so recording can start.
          else goLive()
        })
      }
    }

    return () => {
      cancelled = true
      clearTimer()
      removeIntentListeners()
    }
  }, [paginationReady, storageKey, workspaceRef, pageRef, editor, restoreSettledRef])

  /**
   * Safety net for `restoreSettled`.
   *
   * The load curtain waits on that flag, so every path has to reach it — including the ones where
   * the restore never starts (no document key, refs not yet attached) or never finishes. Without
   * this a stalled restore would leave the editor hidden behind the curtain indefinitely, which is
   * a far worse failure than landing on the wrong page.
   */
  React.useEffect(() => {
    if (!paginationReady || restoreSettled) return

    const settle = (phase: RestorePhase) => {
      if (phaseRef.current === 'restoring') phaseRef.current = phase
      restoreSettledRef.current = true
      setRestoreSettled(true)
    }

    // Nowhere to restore from or into: there is no stored position to protect, so recording is safe.
    if (!storageKey || !workspaceRef.current || !pageRef.current) {
      settle('live')
      return
    }

    // The loop holds its own deadline; this only covers it failing to reach that deadline at all.
    // `blocked`, so a restore that died mid-flight still cannot overwrite the stored page.
    const timeoutId = setTimeout(
      () => settle('blocked'),
      RESTORE_DEADLINE_MS + RESTORE_SAFETY_GRACE_MS,
    )
    return () => clearTimeout(timeoutId)
  }, [paginationReady, restoreSettled, storageKey, workspaceRef, pageRef, restoreSettledRef])

  // ── Record on scroll, and on every way of leaving the page ────────────────
  React.useEffect(() => {
    if (!paginationReady || !storageKey) return
    const workspaceEl = workspaceRef.current
    if (!workspaceEl) return

    let timerId: ReturnType<typeof setTimeout> | null = null

    const record = () => {
      timerId = null
      const pageEl = pageRef.current
      if (!pageEl || phaseRef.current !== 'live') return
      const m = measure(workspaceEl, pageEl)
      // A total of 0 means pagination has not reported one; the sheet derived from it is a guess.
      if (!m || m.totalSheets < 1) return
      rememberScreenplayReadingPosition(storageKey, {
        sheet: m.sheet,
        ratio: m.ratio,
        bodyPage: bodyPageFromSheet(m.sheet, screenplayDomHasCoverTitlePage(pageEl)),
        totalSheets: m.totalSheets,
        scrollTopLayoutPx: m.scrollTopLayoutPx,
      })
    }

    const schedule = () => {
      if (timerId != null) clearTimeout(timerId)
      timerId = setTimeout(record, RECORD_DEBOUNCE_MS)
    }

    const recordNow = () => {
      if (timerId != null) {
        clearTimeout(timerId)
        timerId = null
      }
      record()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') recordNow()
    }

    workspaceEl.addEventListener('scroll', schedule, { passive: true })
    // `pagehide` rather than `beforeunload`: it is the one that also fires on a bfcache eviction
    // and on mobile Safari, where `beforeunload` is unreliable.
    window.addEventListener('pagehide', recordNow)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      workspaceEl.removeEventListener('scroll', schedule)
      window.removeEventListener('pagehide', recordNow)
      document.removeEventListener('visibilitychange', onVisibility)
      // Unmount is the client-side route change — navigating away is the main case this exists for.
      recordNow()
    }
  }, [paginationReady, storageKey, workspaceRef, pageRef])

  return { restoreSettled }
}

/**
 * Moves the caret to the first block now on screen.
 *
 * The editor mounts with `autofocus: 'end'`, which leaves the caret at the bottom of the script
 * while the reader is looking at the page they left off on — so the first keystroke after a revisit
 * would land hundreds of pages away, and the toolbar would report the last block's element type
 * rather than the one under their eyes.
 *
 * The selection is dispatched directly rather than through `editor.commands.focus(pos)` so this
 * never pulls DOM focus away from anything else on the page, and the scroll offset is reasserted
 * afterwards because ProseMirror scrolls a new selection into view.
 */
function placeCaretOnScreen(
  editor: Editor | null,
  workspaceEl: HTMLElement,
  pageEl: HTMLElement,
): void {
  if (!editor || editor.isDestroyed) return
  const viewportTop = workspaceEl.getBoundingClientRect().top
  const blockEl = Array.from(
    pageEl.querySelectorAll<HTMLElement>(
      '.ProseMirror > .node-scriptBlock, .ProseMirror > .script-block',
    ),
  ).find((el) => el.getBoundingClientRect().bottom > viewportTop)
  if (!blockEl) return

  const scrollTop = workspaceEl.scrollTop
  try {
    const { state, view } = editor
    const pos = view.posAtDOM(blockEl, 0)
    if (pos < 0 || pos > state.doc.content.size) return
    // `Selection.near` walks to the nearest position a caret can actually occupy; the raw position
    // sits between nodes, which is not a text position.
    const selection = Selection.near(state.doc.resolve(pos), 1)
    view.dispatch(state.tr.setSelection(selection).setMeta('addToHistory', false))
  } catch {
    // A node ProseMirror no longer maps (a decoration wrapper, a mid-transaction DOM) — the
    // restored scroll position stands on its own.
    return
  }
  workspaceEl.scrollTop = scrollTop
}
