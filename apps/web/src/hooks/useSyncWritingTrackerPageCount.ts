'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authRequest } from '@/lib/authRequest'
import { SYNC_WRITING_TRACKER_CURRENT_PAGES } from '@/mutations/ProjectMutations'
import { PROJECT_SCENES_QUERY_KEY } from 'hooks'
import { readScreenplayPaginationTotalPages } from '../utils/screenplayPaginationRead'
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages'

const REPORT_DEBOUNCE_MS = 450

export interface UseScreenplayPaginationProgressOpts {
  pageRef: React.RefObject<HTMLElement | null>
  projectId: string | undefined
  trackerEnabled: boolean
  canEdit: boolean
}

/**
 * Mirrors pagination into `useScreenplayLivePagesStore` for Screenplay Progress in the shell header.
 * When `canEdit`, also persists `writingTracker.currentPageCount` (tracker must be enabled in Mongo).
 */
export function useSyncWritingTrackerPageCount(opts: UseScreenplayPaginationProgressOpts) {
  const queryClient = useQueryClient()
  const setLive = useScreenplayLivePagesStore((s) => s.setLiveBodyPagesForProject)
  const clearLive = useScreenplayLivePagesStore((s) => s.clearForProject)

  const lastPersistedRef = React.useRef<number | null>(null)
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncMutation = useMutation({
    mutationFn: async ({ projectId: syncId, count }: { projectId: string; count: number }) => {
      return authRequest<unknown>(SYNC_WRITING_TRACKER_CURRENT_PAGES, {
        projectId: syncId,
        currentPageCount: count,
      })
    },
    onError: (error) => {
      console.error('[useScreenplayPaginationProgress]', error)
    },
  })

  const { pageRef, projectId, trackerEnabled, canEdit } = opts

  React.useEffect(() => {
    lastPersistedRef.current = null
  }, [projectId])

  React.useEffect(() => {
    const pid = projectId?.trim()
    /** Only when Mongo writing tracker enabled (same gate as screenplay progress computations). */
    const shouldObserve = Boolean(pid) && trackerEnabled === true

    const el = pageRef.current
    if (!shouldObserve || !el) {
      if (pid) clearLive(pid)
      return undefined
    }

    const flush = () => {
      debounceTimerRef.current = null
      if (!pid) return

      const current = pageRef.current
      if (!current || !document.contains(current)) return

      const n = readScreenplayPaginationTotalPages(current)
      if (n == null) return

      setLive(pid, n)

      const shouldPersist = canEdit && trackerEnabled === true
      if (!shouldPersist) return

      if (lastPersistedRef.current === n) return

      syncMutation.mutate(
        { projectId: pid, count: n },
        {
          onSuccess: () => {
            lastPersistedRef.current = n
          },
          onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ['project', pid] })
            void queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, pid] })
          },
        },
      )
    }

    const schedule = () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(flush, REPORT_DEBOUNCE_MS)
    }

    const moStyle = new MutationObserver(() => {
      schedule()
    })
    moStyle.observe(el, { attributes: true, attributeFilter: ['style'] })

    const moSubtree = new MutationObserver(() => {
      schedule()
    })
    moSubtree.observe(el, { childList: true, subtree: true })

    const roPage = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null
    roPage?.observe(el)

    schedule()

    return () => {
      moStyle.disconnect()
      moSubtree.disconnect()
      roPage?.disconnect()
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      clearLive(pid)
    }
  }, [
    pageRef,
    projectId,
    trackerEnabled,
    canEdit,
    queryClient,
    syncMutation.mutate,
    setLive,
    clearLive,
  ])
}
