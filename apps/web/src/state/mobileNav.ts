import { create } from 'zustand';

interface MobileNavState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** Open state for the mobile nav drawer that replaces the persistent side rail under 768px. */
export const useMobileNavStore = create<MobileNavState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
