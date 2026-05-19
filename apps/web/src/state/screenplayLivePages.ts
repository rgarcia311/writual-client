'use client'

import { create } from 'zustand'

/**
 * Last measured screenplay pagination body total for the mounted editor route.
 * Drives Screenplay Progress in the header while the screenplay workspace is visible.
 */
interface ScreenplayLivePagesState {
  projectId: string | null
  liveBodyPages: number | null
  setLiveBodyPagesForProject: (projectId: string, pages: number) => void
  clearForProject: (expectedProjectId?: string | null) => void
}

export const useScreenplayLivePagesStore = create<ScreenplayLivePagesState>((set) => ({
  projectId: null,
  liveBodyPages: null,
  setLiveBodyPagesForProject: (projectId, pages) => {
    const n = Math.max(1, Math.round(Number(pages)))
    if (!Number.isFinite(n)) return
    set({ projectId, liveBodyPages: n })
  },
  clearForProject: (expectedProjectId) =>
    set((s) => {
      if (!s.projectId) return s
      if (expectedProjectId != null && s.projectId !== expectedProjectId) return s
      return { projectId: null, liveBodyPages: null }
    }),
}))
