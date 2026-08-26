'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  cachedDocumentAsQueryData,
  peekScreenplayDocument,
  peekScreenplayDocumentList,
  readScreenplayDocument,
  readScreenplayDocumentList,
  writeScreenplayDocument,
  writeScreenplayDocumentList,
} from '@/lib/screenplayContentCache'
import {
  SCREENPLAY_DOCUMENT_QUERY_KEY,
  SCREENPLAY_DOCUMENTS_QUERY_KEY,
} from './useScreenplayDocuments'

/**
 * `useLayoutEffect` on the client so hydration lands before paint, `useEffect` on the server where
 * layout effects do not run and React warns about them.
 */
const useHydrationEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

/**
 * Bridges the local screenplay cache and the React Query cache in both directions.
 *
 * Reading: on mount the persisted document list and script body are pushed into the query cache, so
 * every existing consumer (`useScreenplayDocuments`, the editor's own `useQuery`) reports data on
 * its first render and no gate has to wait on the network. Nothing downstream needs to know the
 * data came from disk.
 *
 * Writing: server responses are persisted straight back, so the next visit starts warm.
 *
 * Hydration never overwrites data the query already holds — a fetch that has already landed is by
 * definition newer than what is on disk, and clobbering it would show the reader a stale script.
 */
export interface UseScreenplayLocalCacheOpts {
  projectId: string | undefined
  documentId: string | null
  /** Live `getProjectData` tab-bar payload, if the list query has resolved. */
  documentListData: unknown
  /** Live `getScreenplayDocument` payload, if the body query has resolved. */
  documentData: unknown
}

export function useScreenplayLocalCache({
  projectId,
  documentId,
  documentListData,
  documentData,
}: UseScreenplayLocalCacheOpts): void {
  const queryClient = useQueryClient()

  /**
   * Synchronous session peek, so a hand-off between two mounts inside one session never reports a
   * cache miss it will contradict a tick later.
   */
  const [peekedList, setPeekedList] = React.useState(() =>
    projectId ? peekScreenplayDocumentList(projectId) : null,
  )
  /** Pushes an entry into the query cache unless a fetch has already put something there. */
  const seedQuery = React.useCallback(
    (key: unknown[], data: unknown) => {
      if (data == null) return
      if (queryClient.getQueryState(key)?.data !== undefined) return
      queryClient.setQueryData(key, data)
    },
    [queryClient],
  )

  // ── Document list ─────────────────────────────────────────────────────────
  useHydrationEffect(() => {
    if (!projectId) return
    const key = [SCREENPLAY_DOCUMENTS_QUERY_KEY, projectId]
    if (peekedList) {
      seedQuery(key, peekedList.payload)
      return
    }
    let cancelled = false
    void readScreenplayDocumentList(projectId).then((entry) => {
      if (cancelled || !entry) return
      setPeekedList(entry)
      seedQuery(key, entry.payload)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, peekedList, seedQuery])

  // ── Script body ───────────────────────────────────────────────────────────
  useHydrationEffect(() => {
    if (!projectId || !documentId) return
    const key = [SCREENPLAY_DOCUMENT_QUERY_KEY, projectId, documentId]
    const peeked = peekScreenplayDocument(projectId, documentId)
    if (peeked) {
      seedQuery(key, cachedDocumentAsQueryData(peeked))
      return
    }
    let cancelled = false
    void readScreenplayDocument(projectId, documentId).then((entry) => {
      if (cancelled || !entry) return
      seedQuery(key, cachedDocumentAsQueryData(entry))
    })
    return () => {
      cancelled = true
    }
  }, [projectId, documentId, seedQuery])

  // ── Persist whatever the queries end up holding ───────────────────────────
  React.useEffect(() => {
    if (!projectId || documentListData == null) return
    void writeScreenplayDocumentList(projectId, documentListData)
  }, [projectId, documentListData])

  const serverDocument =
    (documentData as { getScreenplayDocument?: Record<string, any> | null } | undefined)
      ?.getScreenplayDocument ?? null

  React.useEffect(() => {
    if (!projectId || !documentId || !serverDocument) return
    const version = serverDocument.versions?.[0]
    if (version?.content == null) return
    void writeScreenplayDocument({
      projectId,
      documentId,
      version: version.version ?? null,
      source: 'server',
      name: serverDocument.name ?? null,
      isPrimary: Boolean(serverDocument.isPrimary),
      layout: serverDocument.layout ?? null,
      pageCount: serverDocument.pageCount ?? null,
      content: version.content,
    })
  }, [projectId, documentId, serverDocument])
}
