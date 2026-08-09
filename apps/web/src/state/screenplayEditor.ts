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
  /** Document position to anchor the block-type picker, or null when closed. Set by the
   *  editor's double-Enter-on-empty-action detection; read by `BlockTypeMenu`. */
  blockTypeMenuAnchorPos: number | null
  /** Controls whether `SceneOutlineButton` renders on slugline blocks. Toggled from the toolbar. */
  sceneDetailButtonsVisible: boolean
  /** Controls whether `CharacterHoverButton` renders on character cue blocks. Toggled from the toolbar. */
  characterDetailButtonsVisible: boolean
  setActiveType: (type: ScreenplayElementType) => void
  setCanEdit: (canEdit: boolean) => void
  setElementTypeFnRef: (fn: ((type: ScreenplayElementType) => void) | null) => void
  setCollabStatus: (status: CollabStatus) => void
  setConnectedUsers: (users: CollabUser[]) => void
  openBlockTypeMenu: (pos: number) => void
  closeBlockTypeMenu: () => void
  toggleSceneDetailButtons: () => void
  toggleCharacterDetailButtons: () => void
}

export const useScreenplayEditorStore = create<ScreenplayEditorState>((set) => ({
  activeType: 'action',
  canEdit: false,
  setElementTypeFn: null,
  collabStatus: 'idle',
  connectedUsers: [],
  blockTypeMenuAnchorPos: null,
  sceneDetailButtonsVisible: true,
  characterDetailButtonsVisible: true,
  setActiveType: (activeType) => set({ activeType }),
  setCanEdit: (canEdit) => set({ canEdit }),
  setElementTypeFnRef: (fn) => set({ setElementTypeFn: fn }),
  setCollabStatus: (collabStatus) => set({ collabStatus }),
  setConnectedUsers: (connectedUsers) => set({ connectedUsers }),
  openBlockTypeMenu: (pos) => set({ blockTypeMenuAnchorPos: pos }),
  closeBlockTypeMenu: () => set({ blockTypeMenuAnchorPos: null }),
  toggleSceneDetailButtons: () =>
    set((s) => ({ sceneDetailButtonsVisible: !s.sceneDetailButtonsVisible })),
  toggleCharacterDetailButtons: () =>
    set((s) => ({ characterDetailButtonsVisible: !s.characterDetailButtonsVisible })),
}))
