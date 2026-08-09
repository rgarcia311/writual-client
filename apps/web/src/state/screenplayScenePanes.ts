import { create } from 'zustand';
import { normalizeSceneHeadingText } from './screenplaySceneOutline';

/** Assumed pane footprint for clamping — panes aren't measured before mount, so this is a conservative estimate. */
const PANE_WIDTH_PX = 400;
const PANE_MIN_HEIGHT_PX = 200;
const VIEWPORT_EDGE_PAD_PX = 8;
/** Offset from the triggering click so the pane doesn't render directly under the cursor/button. */
const ANCHOR_OFFSET_X_PX = 16;
const ANCHOR_OFFSET_Y_PX = -8;
/** Cascade step for panes opened without a click anchor (defensive fallback only). */
const CASCADE_STEP_PX = 24;
const CASCADE_BASE_PX = 120;
const CASCADE_WRAP = 8;

/**
 * Panes are portaled to `document.body`, so they compete on the document's root stacking context —
 * not just against each other. In-app chrome that isn't wrapped in its own isolating stacking
 * context (e.g. `ScreenplayVerticalToolbarShell`'s `position: relative; zIndex: 3`) competes at that
 * same level, so a low base (starting at 1) rendered a freshly-opened pane underneath it. Start well
 * above any in-app chrome, but below MUI's default Modal z-index (1300) so real dialogs (confirms,
 * share, etc.) still take precedence over a reference pane if both happen to be open.
 */
const BASE_Z_INDEX = 1250;

export interface ScenePaneState {
  /** normalizeSceneHeadingText(sceneHeading) — same key as useScreenplaySceneOutlineStore's scenesByHeading. */
  id: string;
  /** Display text, as typed in the document (not normalized). */
  sceneHeading: string;
  x: number;
  y: number;
  zIndex: number;
}

interface ScreenplayScenePanesState {
  panes: Record<string, ScenePaneState>;
  nextZIndex: number;
  openPane: (sceneHeading: string, anchor?: { x: number; y: number }) => void;
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

export const useScreenplayScenePanesStore = create<ScreenplayScenePanesState>()((set, get) => ({
  panes: {},
  nextZIndex: BASE_Z_INDEX,
  openPane: (sceneHeading, anchor) => {
    const id = normalizeSceneHeadingText(sceneHeading);
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
      panes: { ...panes, [id]: { id, sceneHeading, x, y, zIndex: nextZIndex } },
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
