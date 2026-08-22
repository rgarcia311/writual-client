'use client'

import { create } from 'zustand'

/**
 * Which screenplay document is currently selected, per project.
 *
 * Shared by all three document-aware pages — screenplay, characters and outline — so picking
 * "Draft 2" on the screenplay page also switches the character and scene cards to that draft's
 * entities. Selecting per page instead would let the pages disagree about which script the writer
 * is looking at.
 *
 * Deliberately not persisted: on a fresh visit the project should open on its primary document.
 */
/**
 * A just-imported script waiting to be pushed into the mounted editor.
 *
 * Replacing a document's content does not change which document is selected, so nothing remounts
 * and the editor's one-shot seeding never re-runs. Worse, when collaboration is on, the live Y.Doc
 * still holds the old script and would persist it straight back over the import. Handing the parsed
 * document to the open editor makes the import land as an ordinary collaborative edit, which then
 * syncs to every connected client and persists normally.
 *
 * The content travels through here rather than being re-fetched because the browser parsed the PDF
 * in the first place — using it directly removes any window where the editor could apply stale
 * content that the refetch had not yet replaced.
 */
export interface PendingScreenplayImport {
  documentId: string
  /** TipTap document produced by the client-side PDF parser. */
  doc: unknown
  /** Distinguishes consecutive imports into the same document. */
  token: number
}

interface ScreenplayDocumentsState {
  /** projectId → selected screenplay document id. */
  activeByProject: Record<string, string>
  setActiveDocument: (projectId: string, documentId: string) => void
  clearForProject: (projectId: string) => void
  /** projectId → content waiting to be applied to the mounted editor. */
  pendingImportByProject: Record<string, PendingScreenplayImport>
  publishImportedContent: (projectId: string, documentId: string, doc: unknown) => void
  /** Called by the editor once the content is in, so it is not applied twice. */
  consumeImportedContent: (projectId: string, documentId: string) => void
}

let importToken = 0

export const useScreenplayDocumentsStore = create<ScreenplayDocumentsState>((set) => ({
  activeByProject: {},
  setActiveDocument: (projectId, documentId) =>
    set((s) => ({
      activeByProject: { ...s.activeByProject, [projectId]: documentId },
    })),
  clearForProject: (projectId) =>
    set((s) => {
      if (!(projectId in s.activeByProject)) return s
      const next = { ...s.activeByProject }
      delete next[projectId]
      return { activeByProject: next }
    }),

  pendingImportByProject: {},
  publishImportedContent: (projectId, documentId, doc) =>
    set((s) => ({
      pendingImportByProject: {
        ...s.pendingImportByProject,
        [projectId]: { documentId, doc, token: ++importToken },
      },
    })),
  consumeImportedContent: (projectId, documentId) =>
    set((s) => {
      const pending = s.pendingImportByProject[projectId]
      if (!pending || pending.documentId !== documentId) return s
      const next = { ...s.pendingImportByProject }
      delete next[projectId]
      return { pendingImportByProject: next }
    }),
}))
