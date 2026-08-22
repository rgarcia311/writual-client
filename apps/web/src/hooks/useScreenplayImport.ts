'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getFirebaseAuth } from '@/lib/firebase'
import { parseScreenplayPdf } from '@/lib/parseScreenplayPdf'
import { PROJECT_SCENES_QUERY_KEY } from '@hooks/useProjectSceneMutations'
import {
  SCREENPLAY_DOCUMENT_QUERY_KEY,
  SCREENPLAY_DOCUMENTS_QUERY_KEY,
} from '@hooks/useScreenplayDocuments'

/** Parsing a feature script and enriching it upstream can legitimately take minutes. */
const IMPORT_TIMEOUT_MS = 600_000

export type ScreenplayPdfImportMode = 'replace' | 'add'
export type ScreenplayEntityStrategy = 'all' | 'selected' | 'none'

export interface ScreenplayImportInput {
  projectId: string
  file: File
  mode: ScreenplayPdfImportMode
  /** `replace`: the document to overwrite. Ignored for `add`. */
  documentId?: string | null
  /** `add`: tab label for the new document. Defaults to the file name server-side. */
  documentName?: string | null
  /** Whether to derive character and scene cards from the script (greenlit+). */
  withAi: boolean
  /** `replace` + `withAi` only. */
  entityStrategy?: ScreenplayEntityStrategy
  replaceCharacterIds?: string[]
  replaceSceneIds?: string[]
}

export interface ScreenplayImportResult {
  /**
   * The parsed TipTap document that was imported. Returned so the caller can push it straight into
   * an already-mounted editor, which would otherwise keep showing the script it loaded on mount.
   */
  doc: unknown
  documentId: string
  documentName: string
  isNewDocument: boolean
  charactersCreated: number
  scenesCreated: number
  charactersRemoved: number
  scenesRemoved: number
  entityErrors: string[]
}

/**
 * Runs a screenplay PDF import.
 *
 * The PDF is parsed in the browser (pdf.js) and the resulting TipTap document is posted to the API,
 * which persists it and — for the AI path — derives characters and scenes. Every cache that can
 * show the result is invalidated on success, since an import can touch the screenplay body, the
 * document tab list, and the character and scene cards all at once.
 */
export function useScreenplayImport(projectId: string | undefined) {
  const queryClient = useQueryClient()
  const [progressLabel, setProgressLabel] = React.useState<string | null>(null)

  const mutation = useMutation<ScreenplayImportResult, Error, ScreenplayImportInput>({
    mutationFn: async (input) => {
      setProgressLabel(`Reading ${input.file.name}…`)
      const { doc, pageCount, layout } = await parseScreenplayPdf(input.file)

      setProgressLabel(
        input.withAi
          ? 'Importing script and building character and scene cards…'
          : 'Importing script…',
      )

      const token = await getFirebaseAuth().currentUser?.getIdToken()
      const response = await fetch('/api/screenplay/import-pdf-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectId: input.projectId,
          doc,
          pageCount,
          ...(layout != null ? { layout } : {}),
          mode: input.mode,
          documentId: input.mode === 'replace' ? input.documentId ?? null : null,
          documentName: input.documentName ?? null,
          sourceFileName: input.file.name,
          withAi: input.withAi,
          entityStrategy: input.entityStrategy ?? 'all',
          replaceCharacterIds: input.replaceCharacterIds ?? [],
          replaceSceneIds: input.replaceSceneIds ?? [],
        }),
        signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
      })

      const text = await response.text()
      let body: Partial<ScreenplayImportResult> & { error?: string } = {}
      let parsedJson = false
      if (text) {
        try {
          body = JSON.parse(text) as typeof body
          parsedJson = true
        } catch {
          parsedJson = false
        }
      }

      // A non-JSON body means the request never reached the API — it was answered by the web app
      // itself. Surfacing the raw HTML page would fill the dialog with markup, so name the actual
      // problem instead.
      if (!parsedJson && text.trim() !== '') {
        throw new Error(describeNonJsonResponse(response.status))
      }

      if (!response.ok) {
        throw new Error(
          body.error?.trim() || `Screenplay import failed (HTTP ${response.status})`,
        )
      }

      return { ...(body as ScreenplayImportResult), doc }
    },
    onSettled: async () => {
      setProgressLabel(null)
      if (!projectId) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [SCREENPLAY_DOCUMENTS_QUERY_KEY, projectId] }),
        queryClient.invalidateQueries({ queryKey: [SCREENPLAY_DOCUMENT_QUERY_KEY, projectId] }),
        queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
      ])
    },
  })

  return { ...mutation, progressLabel }
}

/**
 * The import endpoint lives on the API server and is reached through the `/api/screenplay/*` rewrite
 * in `next.config.js`. Next only reads that config at startup, so a dev server started before the
 * rewrite existed answers the request itself with an HTML 404 — the single most likely cause of a
 * non-JSON reply here, and one a restart fixes.
 */
function describeNonJsonResponse(status: number): string {
  if (status === 404) {
    return (
      'The import endpoint was not reachable (404 from the web server). ' +
      'The /api/screenplay/* rewrite is missing from the running dev server — restart it (npm run dev:web) and try again.'
    )
  }
  return `The import endpoint returned an unexpected response (HTTP ${status}). Check that the API server is running.`
}
