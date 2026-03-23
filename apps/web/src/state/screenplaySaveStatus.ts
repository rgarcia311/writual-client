import { create } from 'zustand';

interface ScreenplaySaveStatusState {
  savingCount: number;
  lastSavedAt: number | null;
  hasPendingChanges: boolean;
  setPending: (pending: boolean) => void;
  startSaving: () => void;
  endSaving: (success: boolean) => void;
  reset: () => void;
}

export const useScreenplaySaveStatusStore = create<ScreenplaySaveStatusState>()((set) => ({
  savingCount: 0,
  lastSavedAt: null,
  hasPendingChanges: false,
  setPending: (pending) => set({ hasPendingChanges: pending }),
  startSaving: () =>
    set((s) => ({ savingCount: s.savingCount + 1 })),
  endSaving: (success) =>
    set((s) => ({
      savingCount: Math.max(0, s.savingCount - 1),
      lastSavedAt: success ? Date.now() : s.lastSavedAt,
      hasPendingChanges: success ? false : s.hasPendingChanges,
    })),
  reset: () => set({ savingCount: 0, lastSavedAt: null, hasPendingChanges: false }),
}));
