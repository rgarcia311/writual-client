import { create } from 'zustand';

interface OutlineSaveStatusState {
  savingCount: number;
  lastSavedAt: number | null;
  startSaving: () => void;
  endSaving: (success: boolean) => void;
  reset: () => void;
}

export const useOutlineSaveStatusStore = create<OutlineSaveStatusState>()((set) => ({
  savingCount: 0,
  lastSavedAt: null,
  startSaving: () =>
    set((s) => ({ savingCount: s.savingCount + 1 })),
  endSaving: (success) =>
    set((s) => ({
      savingCount: Math.max(0, s.savingCount - 1),
      lastSavedAt: success ? Date.now() : s.lastSavedAt,
    })),
  reset: () => set({ savingCount: 0, lastSavedAt: null }),
}));
