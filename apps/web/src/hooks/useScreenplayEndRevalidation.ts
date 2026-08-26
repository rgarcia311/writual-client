'use client'

import * as React from 'react'

/** How close to the bottom counts as "at the end", in device px. */
const END_THRESHOLD_PX = 1200

/** Floor between two revalidations, so nudging the scrollbar at the end does not spam the API. */
const MIN_INTERVAL_MS = 30_000

/**
 * Calls `onReachEnd` when the reader scrolls to the bottom of the screenplay.
 *
 * The revisit path mounts the editor from the local cache without waiting on the network, so the
 * server read has to happen somewhere else; doing it when the reader reaches the end of what they
 * have keeps it off the critical path. The callback is expected to kick off a background refetch —
 * it must not remount the editor or move `workspaceEl.scrollTop`, or the reader would be thrown out
 * of the page they were reading.
 */
export function useScreenplayEndRevalidation(opts: {
  workspaceRef: React.RefObject<HTMLElement | null>
  enabled: boolean
  onReachEnd: () => void
}): void {
  const { workspaceRef, enabled, onReachEnd } = opts

  /** Mirrored so the scroll listener never has to be re-registered when the callback changes. */
  const onReachEndRef = React.useRef(onReachEnd)
  React.useEffect(() => {
    onReachEndRef.current = onReachEnd
  }, [onReachEnd])

  React.useEffect(() => {
    if (!enabled) return
    const workspaceEl = workspaceRef.current
    if (!workspaceEl) return

    let lastFiredAt = 0
    let rafId: number | null = null

    const check = () => {
      rafId = null
      const distanceToEnd =
        workspaceEl.scrollHeight - workspaceEl.scrollTop - workspaceEl.clientHeight
      if (distanceToEnd > END_THRESHOLD_PX) return
      const now = Date.now()
      if (now - lastFiredAt < MIN_INTERVAL_MS) return
      lastFiredAt = now
      onReachEndRef.current()
    }

    const onScroll = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(check)
    }

    workspaceEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      workspaceEl.removeEventListener('scroll', onScroll)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [enabled, workspaceRef])
}
