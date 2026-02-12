import { create } from 'zustand'

export interface OptimisticScene {
  number: number
  versions: any[]
  activeVersion?: number
  lockedVersion?: number | null
}

interface CreateSceneModalState {
  pendingNewScene: OptimisticScene | null
  setPendingNewScene: (scene: OptimisticScene | null) => void
}

export const useCreateSceneModalStore = create<CreateSceneModalState>()((set) => ({
  pendingNewScene: null,
  setPendingNewScene: (scene) => set({ pendingNewScene: scene }),
}))
