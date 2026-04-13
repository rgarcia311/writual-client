import { create } from 'zustand'
import type { ScreenplayElementType } from '@/components/ScreenplayEditor/ScreenplayExtension'

export type CollabStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface CollabUser {
  name: string
  color: string
  avatarUrl?: string
}

interface ScreenplayEditorState {
  activeType: ScreenplayElementType
  canEdit: boolean
  setElementTypeFn: ((type: ScreenplayElementType) => void) | null
  collabStatus: CollabStatus
  connectedUsers: CollabUser[]
  setActiveType: (type: ScreenplayElementType) => void
  setCanEdit: (canEdit: boolean) => void
  setElementTypeFnRef: (fn: ((type: ScreenplayElementType) => void) | null) => void
  setCollabStatus: (status: CollabStatus) => void
  setConnectedUsers: (users: CollabUser[]) => void
}

export const useScreenplayEditorStore = create<ScreenplayEditorState>((set) => ({
  activeType: 'action',
  canEdit: false,
  setElementTypeFn: null,
  collabStatus: 'idle',
  connectedUsers: [],
  setActiveType: (activeType) => set({ activeType }),
  setCanEdit: (canEdit) => set({ canEdit }),
  setElementTypeFnRef: (fn) => set({ setElementTypeFn: fn }),
  setCollabStatus: (collabStatus) => set({ collabStatus }),
  setConnectedUsers: (connectedUsers) => set({ connectedUsers }),
}))
