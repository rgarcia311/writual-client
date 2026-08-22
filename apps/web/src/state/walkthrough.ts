import { create } from 'zustand';

/**
 * Runtime state for the intro walkthrough. Deliberately *not* persisted — whether the tour should
 * greet a user on login is answered by `settings.walkthroughDismissed` on their account, so a
 * half-finished run never survives a reload as a stuck overlay.
 */
interface WalkthroughState {
  /** The tour is on screen. */
  active: boolean;
  /** Index into the step list from `walkthroughSteps`. */
  stepIndex: number;
  /** Set while the user is replaying from Settings, so auto-start can't fight a manual start. */
  startedManually: boolean;
  start: (options?: { manual?: boolean }) => void;
  stop: () => void;
  goToStep: (stepIndex: number) => void;
  next: () => void;
  back: () => void;
}

export const useWalkthroughStore = create<WalkthroughState>()((set) => ({
  active: false,
  stepIndex: 0,
  startedManually: false,
  start: ({ manual = false } = {}) =>
    set({ active: true, stepIndex: 0, startedManually: manual }),
  stop: () => set({ active: false, stepIndex: 0, startedManually: false }),
  goToStep: (stepIndex) => set({ stepIndex: Math.max(0, stepIndex) }),
  next: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),
  back: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
}));
