'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { captureScreenplaySnapshot } from '@/lib/screenplaySnapshotCapture'
import {
  peekScreenplaySnapshot,
  readScreenplaySnapshot,
  writeScreenplaySnapshot,
} from '@/lib/screenplaySnapshotCache'

/** Idle gap before a scroll or edit is written to the cache. */
const CAPTURE_DEBOUNCE_MS = 900

/**
 * Ceiling on how long the load curtain may stay up. PageBreakPlugin normally settles well inside
 * this (a `scheduleRecalc` at ~100ms, a fonts-ready pass, and a 500ms settle pass), but if it never
 * writes `--total-pages` — an empty document, a thrown measure pass — the reader must still get the
 * live editor rather than being stranded behind a static image of it.
 */
const PAGINATION_READY_TIMEOUT_MS = 8000

export interface UseScreenplaySnapshotPersistenceOpts {
  projectId: string | undefined
  /** The `.screenplay-workspace` scroll container. */
  workspaceRef: React.RefObject<HTMLElement | null>
  /** The `.screenplay-page` pagination root. */
  pageRef: React.RefObject<HTMLElement | null>
  /** False until Tiptap resolves; the refs above are unattached before that. */
  editorReady: boolean
  editor: Editor | null
}

export interface ScreenplaySnapshotPersistence {
  /**
   * True once PageBreakPlugin has paginated at least once, i.e. the live pages are in their final
   * positions and the curtain can come down.
   */
  paginationReady: boolean
}

/**
 * Keeps the local paint cache for this screenplay in step with the reader, and restores their last
 * scroll position once the real document is paginated.
 *
 * The cache is written from the DOM, never from the editor's document, and is never read back into
 * the editor — see `screenplaySnapshotCache.ts` for why that separation matters.
 */
export function useScreenplaySnapshotPersistence(
  opts: UseScreenplaySnapshotPersistenceOpts,
): ScreenplaySnapshotPersistence {
  const { projectId, workspaceRef, pageRef, editorReady, editor } = opts
  const [paginationReady, setPaginationReady] = React.useState(false)
  const restoredRef = React.useRef(false)

  React.useEffect(() => {
    restoredRef.current = false
    setPaginationReady(false)
  }, [projectId])

  // ── Readiness: wait for PageBreakPlugin's first `--total-pages` write ──────
  React.useEffect(() => {
    if (!editorReady) return
    const pageEl = pageRef.current
    if (!pageEl) return

    let rafId: number | null = null
    const markReady = () => {
      if (rafId != null) return
      // One frame of slack so the decorations that came with the write are painted.
      rafId = requestAnimationFrame(() => setPaginationReady(true))
    }

    const hasTotal = () => pageEl.style.getPropertyValue('--total-pages').trim() !== ''
    if (hasTotal()) {
      markReady()
    }

    const observer = new MutationObserver(() => {
      if (hasTotal()) markReady()
    })
    observer.observe(pageEl, { attributes: true, attributeFilter: ['style'] })
    const timeoutId = setTimeout(() => setPaginationReady(true), PAGINATION_READY_TIMEOUT_MS)

    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [editorReady, pageRef])

  // ── Restore the reader's last scroll position, once, after pagination ─────
  React.useEffect(() => {
    if (!paginationReady || !projectId || restoredRef.current) return
    const workspaceEl = workspaceRef.current
    const pageEl = pageRef.current
    if (!workspaceEl || !pageEl) return

    restoredRef.current = true
    let cancelled = false

    const apply = (scrollTopLayoutPx: number) => {
      if (cancelled || !workspaceEl.isConnected) return
      const pmEl = pageEl.querySelector<HTMLElement>('.ProseMirror')
      // Re-derive the scale rather than trusting the capture-time zoom: auto-fit may have landed
      // somewhere else this time (different window size), and the stored offset is layout-space.
      const scale =
        pmEl && pmEl.offsetWidth > 0 ? pmEl.getBoundingClientRect().width / pmEl.offsetWidth : 1
      if (!Number.isFinite(scale) || scale <= 0) return
      workspaceEl.scrollTop = scrollTopLayoutPx * scale
    }

    const memo = peekScreenplaySnapshot(projectId)
    if (memo) {
      apply(memo.scrollTopLayoutPx)
    } else {
      void readScreenplaySnapshot(projectId).then((snap) => {
        if (snap) apply(snap.scrollTopLayoutPx)
      })
    }

    return () => {
      cancelled = true
    }
  }, [paginationReady, projectId, workspaceRef, pageRef])

  // ── Capture on scroll / edit / page hide ──────────────────────────────────
  React.useEffect(() => {
    if (!paginationReady || !projectId) return
    const workspaceEl = workspaceRef.current
    if (!workspaceEl) return

    let timerId: ReturnType<typeof setTimeout> | null = null

    const capture = () => {
      timerId = null
      const pageEl = pageRef.current
      if (!pageEl) return
      const snapshot = captureScreenplaySnapshot({ projectId, workspaceEl, pageEl })
      if (snapshot) void writeScreenplaySnapshot(snapshot)
    }

    const schedule = () => {
      if (timerId != null) clearTimeout(timerId)
      timerId = setTimeout(capture, CAPTURE_DEBOUNCE_MS)
    }

    const captureNow = () => {
      if (timerId != null) {
        clearTimeout(timerId)
        timerId = null
      }
      capture()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') captureNow()
    }

    workspaceEl.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('pagehide', captureNow)
    document.addEventListener('visibilitychange', onVisibility)
    editor?.on('update', schedule)

    // Seed the cache immediately so a first-ever visit still leaves something behind.
    schedule()

    return () => {
      workspaceEl.removeEventListener('scroll', schedule)
      window.removeEventListener('pagehide', captureNow)
      document.removeEventListener('visibilitychange', onVisibility)
      editor?.off('update', schedule)
      captureNow()
    }
  }, [paginationReady, projectId, workspaceRef, pageRef, editor])

  return { paginationReady }
}
