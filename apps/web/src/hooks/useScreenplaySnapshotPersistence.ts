'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { captureScreenplaySnapshot } from '@/lib/screenplaySnapshotCapture'
import { writeScreenplaySnapshot } from '@/lib/screenplaySnapshotCache'

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
  /**
   * Flipped true by `useScreenplayReadingPosition` once it has stopped steering the scroll.
   *
   * Capturing before then would cache the pages around wherever the restore currently is — the top
   * of the document, most of the time — and the next visit's curtain would paint page one no matter
   * which page the reader is actually returning to. A ref rather than a prop because the two hooks
   * feed each other: this one produces `paginationReady`, which is what the other one waits on.
   */
  restoreSettledRef: React.RefObject<boolean>
}

export interface ScreenplaySnapshotPersistence {
  /**
   * True once PageBreakPlugin has paginated at least once, i.e. the live pages are in their final
   * positions and the curtain can come down.
   */
  paginationReady: boolean
}

/**
 * Keeps the local paint cache for this screenplay in step with the reader, and reports when the
 * live pages have finished paginating.
 *
 * The cache is written from the DOM, never from the editor's document, and is never read back into
 * the editor — see `screenplaySnapshotCache.ts` for why that separation matters. Putting the reader
 * back where they were is `useScreenplayReadingPosition`'s job: it restores from a synchronously
 * readable page number, which lands in the same frame `paginationReady` flips rather than after an
 * IndexedDB read.
 */
export function useScreenplaySnapshotPersistence(
  opts: UseScreenplaySnapshotPersistenceOpts,
): ScreenplaySnapshotPersistence {
  const { projectId, workspaceRef, pageRef, editorReady, editor, restoreSettledRef } = opts
  const [paginationReady, setPaginationReady] = React.useState(false)

  React.useEffect(() => {
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

  // ── Capture on scroll / edit / page hide ──────────────────────────────────
  React.useEffect(() => {
    if (!paginationReady || !projectId) return
    const workspaceEl = workspaceRef.current
    if (!workspaceEl) return

    let timerId: ReturnType<typeof setTimeout> | null = null

    /**
     * `mayRetry` is false on the leaving-the-page paths, where re-arming a timer would either never
     * fire (unmount) or outlive the document. Skipping the write there leaves the previous snapshot
     * in place, which is the right answer anyway: it is the last one taken from a settled layout.
     */
    const capture = (mayRetry: boolean) => {
      timerId = null
      const pageEl = pageRef.current
      if (!pageEl) return
      if (!restoreSettledRef.current) {
        if (mayRetry) schedule()
        return
      }
      const snapshot = captureScreenplaySnapshot({ projectId, workspaceEl, pageEl })
      if (snapshot) void writeScreenplaySnapshot(snapshot)
    }

    const schedule = () => {
      if (timerId != null) clearTimeout(timerId)
      timerId = setTimeout(() => capture(true), CAPTURE_DEBOUNCE_MS)
    }

    const captureNow = () => {
      if (timerId != null) {
        clearTimeout(timerId)
        timerId = null
      }
      capture(false)
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
  }, [paginationReady, projectId, workspaceRef, pageRef, editor, restoreSettledRef])

  return { paginationReady }
}
