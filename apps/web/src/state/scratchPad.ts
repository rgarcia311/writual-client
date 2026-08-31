import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Session-only scratch pad. Content lives in `sessionStorage`, so it survives navigation
 * between project pages and a reload of the tab, but is gone once the tab closes — the pad
 * tells the user as much, and converting to a note is the way to keep anything.
 */

const STORAGE_KEY = 'writual-scratch-pad';

export const SCRATCH_PAD_DEFAULT_WIDTH_PX = 420;
export const SCRATCH_PAD_DEFAULT_HEIGHT_PX = 460;
export const SCRATCH_PAD_MIN_WIDTH_PX = 300;
export const SCRATCH_PAD_MIN_HEIGHT_PX = 300;
const VIEWPORT_EDGE_PAD_PX = 8;
/** Distance from the viewport's right/top edge for the pad's first ever placement. */
const INITIAL_RIGHT_INSET_PX = 32;
const INITIAL_TOP_PX = 96;

interface ScratchPadState {
  /** Project whose pad is on screen, or null when the pad is closed. */
  openProjectId: string | null;
  /** Null until the pad is first placed — the position is computed from the viewport then. */
  x: number | null;
  y: number | null;
  width: number;
  height: number;
  /** Pad HTML per project, so switching projects doesn't mix scratch notes. */
  contentByProject: Record<string, string>;
  openPad: (projectId: string) => void;
  closePad: () => void;
  togglePad: (projectId: string) => void;
  setPosition: (x: number, y: number) => void;
  setSize: (width: number, height: number) => void;
  setContent: (projectId: string, html: string) => void;
  clearContent: (projectId: string) => void;
}

function initialPosition(width: number): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: VIEWPORT_EDGE_PAD_PX, y: INITIAL_TOP_PX };
  return {
    x: Math.max(VIEWPORT_EDGE_PAD_PX, window.innerWidth - width - INITIAL_RIGHT_INSET_PX),
    y: INITIAL_TOP_PX,
  };
}

/** Keeps the pad reachable: its top-left never leaves the viewport, whatever the drag did. */
function clampToViewport(x: number, y: number, width: number, height: number) {
  if (typeof window === 'undefined') return { x, y };
  const maxX = Math.max(VIEWPORT_EDGE_PAD_PX, window.innerWidth - width - VIEWPORT_EDGE_PAD_PX);
  const maxY = Math.max(VIEWPORT_EDGE_PAD_PX, window.innerHeight - height - VIEWPORT_EDGE_PAD_PX);
  return {
    x: Math.min(Math.max(x, VIEWPORT_EDGE_PAD_PX), maxX),
    y: Math.min(Math.max(y, VIEWPORT_EDGE_PAD_PX), maxY),
  };
}

export const useScratchPadStore = create<ScratchPadState>()(
  persist(
    (set, get) => ({
      openProjectId: null,
      x: null,
      y: null,
      width: SCRATCH_PAD_DEFAULT_WIDTH_PX,
      height: SCRATCH_PAD_DEFAULT_HEIGHT_PX,
      contentByProject: {},
      openPad: (projectId) => {
        const { x, y, width } = get();
        const placed = x === null || y === null ? initialPosition(width) : { x, y };
        set({ openProjectId: projectId, ...placed });
      },
      closePad: () => set({ openProjectId: null }),
      togglePad: (projectId) => {
        const { openProjectId, closePad, openPad } = get();
        if (openProjectId === projectId) closePad();
        else openPad(projectId);
      },
      setPosition: (x, y) => {
        const { width, height } = get();
        set(clampToViewport(x, y, width, height));
      },
      setSize: (width, height) =>
        set({
          width: Math.max(SCRATCH_PAD_MIN_WIDTH_PX, Math.round(width)),
          height: Math.max(SCRATCH_PAD_MIN_HEIGHT_PX, Math.round(height)),
        }),
      setContent: (projectId, html) =>
        set({ contentByProject: { ...get().contentByProject, [projectId]: html } }),
      clearContent: (projectId) => {
        const next = { ...get().contentByProject };
        delete next[projectId];
        set({ contentByProject: next });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ openProjectId, x, y, width, height, contentByProject }) => ({
        openProjectId,
        x,
        y,
        width,
        height,
        contentByProject,
      }),
    }
  )
);

/** True when the pad holds something worth keeping (Tiptap emits '' for an empty document). */
export function scratchPadHasContent(html: string | undefined): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
}
