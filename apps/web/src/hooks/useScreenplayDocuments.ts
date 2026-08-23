'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { request } from 'graphql-request'
import { SCREENPLAY_DOCUMENTS_QUERY } from '@/queries/ScreenplayQueries'
import { GRAPHQL_ENDPOINT } from '@/lib/config'
import { useUserProfileStore } from '@/state/user'
import { useScreenplayDocumentsStore } from '@/state/screenplayDocuments'

export const SCREENPLAY_DOCUMENTS_QUERY_KEY = 'screenplay-documents'
/** Cache key for one document's script body: [key, projectId, documentId]. */
export const SCREENPLAY_DOCUMENT_QUERY_KEY = 'screenplay-document'

export interface ScreenplayDocumentSummary {
  _id: string
  name: string
  isPrimary: boolean
  order: number
  sourceFileName: string | null
  pageCount: number | null
  /** Version stubs only — enough to tell an empty document from one with a script in it. */
  versions: Array<{ version: number }>
}

export interface UseScreenplayDocumentsResult {
  documents: ScreenplayDocumentSummary[]
  /** The project's own title — the name its first screenplay carries, and the title page's title. */
  projectTitle: string | null
  /** The selected document, or the primary when nothing has been picked yet. */
  activeDocument: ScreenplayDocumentSummary | null
  activeDocumentId: string | null
  setActiveDocumentId: (documentId: string) => void
  isLoading: boolean
}

/**
 * Screenplay documents for a project plus the current tab selection.
 *
 * Used by the screenplay, characters and outline pages so all three agree on which script the
 * writer is looking at. The selection lives in a store rather than here so switching pages does not
 * reset it back to the primary document.
 */
export function useScreenplayDocuments(
  projectId: string | undefined,
): UseScreenplayDocumentsResult {
  const user = useUserProfileStore((s) => s.userProfile?.user)
  const activeByProject = useScreenplayDocumentsStore((s) => s.activeByProject)
  const setActiveDocument = useScreenplayDocumentsStore((s) => s.setActiveDocument)

  const { data, isLoading } = useQuery({
    queryKey: [SCREENPLAY_DOCUMENTS_QUERY_KEY, projectId],
    queryFn: () =>
      request(GRAPHQL_ENDPOINT, SCREENPLAY_DOCUMENTS_QUERY, {
        input: { user, _id: projectId },
      }),
    enabled: Boolean(projectId && user),
  }) as {
    data?: {
      getProjectData?: Array<{ title?: string | null; screenplayDocuments?: ScreenplayDocumentSummary[] }>
    }
    isLoading: boolean
  }

  const documents = React.useMemo(
    () => data?.getProjectData?.[0]?.screenplayDocuments ?? [],
    [data],
  )

  const projectTitle = data?.getProjectData?.[0]?.title ?? null

  const stored = projectId ? activeByProject[projectId] : undefined

  const activeDocument = React.useMemo(() => {
    if (documents.length === 0) return null
    // A stored id can go stale when the document is deleted, or when another collaborator removes
    // it; fall back to the primary rather than rendering an empty editor.
    const selected = stored ? documents.find((d) => d._id === stored) : undefined
    return selected ?? documents.find((d) => d.isPrimary) ?? documents[0]
  }, [documents, stored])

  const setActiveDocumentId = React.useCallback(
    (documentId: string) => {
      if (!projectId) return
      setActiveDocument(projectId, documentId)
    },
    [projectId, setActiveDocument],
  )

  return {
    documents,
    projectTitle,
    activeDocument,
    activeDocumentId: activeDocument?._id ?? null,
    setActiveDocumentId,
    isLoading,
  }
}
