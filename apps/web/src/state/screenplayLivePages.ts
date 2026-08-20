'use client'

import { create } from 'zustand'

/**
 * Last measured screenplay pagination body total for the mounted editor route.
 * Drives Screenplay Progress in the header while the screenplay workspace is visible.
 */
interface ScreenplayLivePagesState {
  projectId: string | null
  /** Measured from the paginated DOM. Null until PageBreakPlugin's first pass lands. */
  liveBodyPages: number | null
  /**
   * The server's own body-page total (`screenplay.pageCount`), pushed as soon as project data
   * arrives. Display-only fallback so the toolbar shows a real number during the seconds before
   * the client has paginated, instead of an em dash. Never persisted back.
   */
  seedBodyPages: number | null
  setLiveBodyPagesForProject: (projectId: string, pages: number) => void
  setSeedBodyPagesForProject: (projectId: string, pages: number) => void
  clearForProject: (expectedProjectId?: string | null) => void
}

/** A body total of 0 is legitimate — a document that is still nothing but its title page. */
function normalizePages(pages: number): number | null {
  const n = Math.round(Number(pages))
  if (!Number.isFinite(n)) return null
  return Math.max(0, n)
}

export const useScreenplayLivePagesStore = create<ScreenplayLivePagesState>((set) => ({
  projectId: null,
  liveBodyPages: null,
  seedBodyPages: null,
  setLiveBodyPagesForProject: (projectId, pages) => {
    const n = normalizePages(pages)
    if (n == null) return
    set((s) => ({
      projectId,
      liveBodyPages: n,
      seedBodyPages: s.projectId === projectId ? s.seedBodyPages : null,
    }))
  },
  setSeedBodyPagesForProject: (projectId, pages) => {
    const n = normalizePages(pages)
    if (n == null) return
    set((s) => ({
      projectId,
      seedBodyPages: n,
      liveBodyPages: s.projectId === projectId ? s.liveBodyPages : null,
    }))
  },
  clearForProject: (expectedProjectId) =>
    set((s) => {
      if (!s.projectId) return s
      if (expectedProjectId != null && s.projectId !== expectedProjectId) return s
      return { projectId: null, liveBodyPages: null, seedBodyPages: null }
    }),
}))
