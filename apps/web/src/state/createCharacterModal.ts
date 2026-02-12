import { create } from 'zustand'

interface CreateCharacterModalState {
  pendingNewCharacter: boolean
  setPendingNewCharacter: (pending: boolean) => void
}

export const useCreateCharacterModalStore = create<CreateCharacterModalState>()((set) => ({
  pendingNewCharacter: false,
  setPendingNewCharacter: (pending) => set({ pendingNewCharacter: pending }),
}))
