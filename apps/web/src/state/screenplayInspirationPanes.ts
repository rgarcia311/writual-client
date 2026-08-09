import { create } from 'zustand';

/** Assumed pane footprint for clamping — panes aren't measured before mount, so this is a conservative estimate. */
const PANE_WIDTH_PX = 320;
const PANE_MIN_HEIGHT_PX = 220;
const VIEWPORT_EDGE_PAD_PX = 8;
/** Offset from the triggering click so the pane doesn't render directly under the cursor/button. */
const ANCHOR_OFFSET_X_PX = 16;
const ANCHOR_OFFSET_Y_PX = -8;
/** Cascade step for panes opened without a click anchor (e.g. from a toolbar menu). */
const CASCADE_STEP_PX = 24;
const CASCADE_BASE_PX = 120;
const CASCADE_WRAP = 8;

/** See screenplayScenePanes.ts for the z-index rationale — same portal-to-`document.body` setup. */
const BASE_Z_INDEX = 1250;

export interface InspirationPaneState {
  /** Inspiration item `_id`. */
  id: string;
  /** Display title, snapshotted at open time (falls back to live data via `projectData.inspiration`). */
  title: string;
  x: number;
  y: number;
  zIndex: number;
}

interface ScreenplayInspirationPanesState {
  panes: Record<string, InspirationPaneState>;
  nextZIndex: number;
  openPane: (id: string, title: string, anchor?: { x: number; y: number }) => void;
  closePane: (id: string) => void;
  closeAllPanes: () => void;
  bringToFront: (id: string) => void;
  updatePanePosition: (id: string, x: number, y: number) => void;
}

function clampToViewport(x: number, y: number): { x: number; y: number } {
  const maxX =
    typeof window === 'undefined'
      ? x
      : Math.max(VIEWPORT_EDGE_PAD_PX, window.innerWidth - PANE_WIDTH_PX - VIEWPORT_EDGE_PAD_PX);
  const maxY =
    typeof window === 'undefined'
      ? y
      : Math.max(VIEWPORT_EDGE_PAD_PX, window.innerHeight - PANE_MIN_HEIGHT_PX - VIEWPORT_EDGE_PAD_PX);
  return {
    x: Math.min(Math.max(x, VIEWPORT_EDGE_PAD_PX), maxX),
    y: Math.min(Math.max(y, VIEWPORT_EDGE_PAD_PX), maxY),
  };
}

export const useScreenplayInspirationPanesStore = create<ScreenplayInspirationPanesState>()((set, get) => ({
  panes: {},
  nextZIndex: BASE_Z_INDEX,
  openPane: (id, title, anchor) => {
    const { panes, nextZIndex } = get();
    const existing = panes[id];
    if (existing) {
      set({
        panes: { ...panes, [id]: { ...existing, zIndex: nextZIndex } },
        nextZIndex: nextZIndex + 1,
      });
      return;
    }
    const openCount = Object.keys(panes).length;
    const raw = anchor
      ? { x: anchor.x + ANCHOR_OFFSET_X_PX, y: anchor.y + ANCHOR_OFFSET_Y_PX }
      : {
          x: CASCADE_BASE_PX + CASCADE_STEP_PX * (openCount % CASCADE_WRAP),
          y: CASCADE_BASE_PX + CASCADE_STEP_PX * (openCount % CASCADE_WRAP),
        };
    const { x, y } = clampToViewport(raw.x, raw.y);
    set({
      panes: { ...panes, [id]: { id, title, x, y, zIndex: nextZIndex } },
      nextZIndex: nextZIndex + 1,
    });
  },
  closePane: (id) => {
    const { panes } = get();
    if (!(id in panes)) return;
    const next = { ...panes };
    delete next[id];
    set({ panes: next });
  },
  closeAllPanes: () => set({ panes: {} }),
  bringToFront: (id) => {
    const { panes, nextZIndex } = get();
    const existing = panes[id];
    if (!existing) return;
    set({
      panes: { ...panes, [id]: { ...existing, zIndex: nextZIndex } },
      nextZIndex: nextZIndex + 1,
    });
  },
  updatePanePosition: (id, x, y) => {
    const { panes } = get();
    const existing = panes[id];
    if (!existing) return;
    const clamped = clampToViewport(x, y);
    set({ panes: { ...panes, [id]: { ...existing, ...clamped } } });
  },
}));
