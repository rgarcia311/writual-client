'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authRequest } from '@/lib/authRequest'
import { SYNC_WRITING_TRACKER_CURRENT_PAGES } from '@/mutations/ProjectMutations'
import { PROJECT_SCENES_QUERY_KEY } from 'hooks'
import { readScreenplayBodyPageCount } from '../utils/screenplayPaginationRead'
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages'

const REPORT_DEBOUNCE_MS = 450

export interface UseScreenplayPaginationProgressOpts {
  pageRef: React.RefObject<HTMLElement | null>
  projectId: string | undefined
  trackerEnabled: boolean
  canEdit: boolean
  /**
   * Whether `pageRef` can be expected to be attached yet.
   *
   * `WritualEditor` renders `null` until Tiptap resolves (`immediatelyRender: false`), so on the
   * first render(s) the `.screenplay-page` element does not exist and `pageRef.current` is null
   * when this effect runs. None of the other deps necessarily change afterwards, so without a dep
   * that flips when the tree mounts, the effect bails on the null ref, never re-runs, and the
   * observers are never attached — leaving the toolbar's page count at "—" for the session.
   */
  editorReady: boolean
}

/**
 * Mirrors pagination into `useScreenplayLivePagesStore` for the screenplay toolbar and shell stats.
 * Body-page total excludes the title page (matches PageBreakPlugin `--total-pages`).
 * When `canEdit` and the writing tracker is enabled, also persists `writingTracker.currentPageCount`.
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

  const { pageRef, projectId, trackerEnabled, canEdit, editorReady } = opts

  React.useEffect(() => {
    lastPersistedRef.current = null
  }, [projectId])

  React.useEffect(() => {
    const pid = projectId?.trim()
    const shouldObserve = Boolean(pid) && editorReady

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

      const n = readScreenplayBodyPageCount(current)
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
    editorReady,
    projectId,
    trackerEnabled,
    canEdit,
    queryClient,
    syncMutation.mutate,
    setLive,
    clearLive,
  ])
}
