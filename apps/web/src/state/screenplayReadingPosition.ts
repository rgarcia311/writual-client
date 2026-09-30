'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  screenplayPageWindow,
  type ScreenplayPageAnchor,
} from '@/components/ScreenplayEditor/screenplayPageGeometry'

/**
 * The page each screenplay was last left on, persisted to localStorage.
 *
 * This is the small, synchronous half of the local revisit path. The bulk — the rendered blocks of
 * the reader's window of pages, and the script body itself — stays in IndexedDB
 * (`screenplaySnapshotCache`, `screenplayContentCache`), because a feature script runs to hundreds
 * of KB and localStorage writes block the main thread, which is the exact stall the local cache
 * exists to remove. What lives here is a handful of numbers per document, and it is here precisely
 * *because* localStorage is synchronous: zustand rehydrates it before the first render, so the
 * editor knows which page to scroll to in the same frame it paginates, instead of jumping there
 * after an IndexedDB round trip has resolved.
 *
 * Positions are recorded when the reader leaves — a route change, a tab hide, a refresh — and
 * while they scroll, so an abrupt close still leaves something behind.
 */

/** Entries older than this are ignored on read; the reader has long since moved on. */
const POSITION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

/** Cap on remembered documents, so a busy account cannot grow this without bound. */
const MAX_REMEMBERED_DOCUMENTS = 40

export interface ScreenplayReadingPosition extends ScreenplayPageAnchor {
  /** The page as a writer would say it — cover sheet excluded. Display only. */
  bodyPage: number
  /** Physical sheets the document paginated to when this was recorded, cover included. */
  totalSheets: number
  /** First sheet of the locally cached window (`sheet` − 5, clipped to the document). */
  windowStart: number
  /** Last sheet of the locally cached window (`sheet` + 5, clipped to the document). */
  windowEnd: number
  /**
   * Workspace `scrollTop` in layout px at capture time. The sheet anchor above is what restores the
   * reader, since it survives a repagination; this is kept for the paint curtain, which replays a
   * picture captured at this exact offset and would misalign against a re-derived one.
   */
  scrollTopLayoutPx: number
  updatedAt: number
}

/** What a caller measures; the window and the timestamp are derived here. */
export type ScreenplayReadingPositionInput = Omit<
  ScreenplayReadingPosition,
  'windowStart' | 'windowEnd' | 'updatedAt'
>

interface ScreenplayReadingPositionState {
  /** `${projectId}:${documentId}` → where that document was last left. */
  byDocument: Record<string, ScreenplayReadingPosition>
  rememberReadingPosition: (key: string, position: ScreenplayReadingPositionInput) => void
  forgetReadingPosition: (key: string) => void
}

const STORAGE_KEY = 'writual-screenplay-reading-position'

/** Drops the least recently visited documents once the map outgrows its cap. */
function withinCap(
  byDocument: Record<string, ScreenplayReadingPosition>,
): Record<string, ScreenplayReadingPosition> {
  const keys = Object.keys(byDocument)
  if (keys.length <= MAX_REMEMBERED_DOCUMENTS) return byDocument
  const kept = keys
    .sort((a, b) => (byDocument[b]?.updatedAt ?? 0) - (byDocument[a]?.updatedAt ?? 0))
    .slice(0, MAX_REMEMBERED_DOCUMENTS)
  return Object.fromEntries(kept.map((k) => [k, byDocument[k]]))
}

export const useScreenplayReadingPositionStore = create<ScreenplayReadingPositionState>()(
  persist(
    (set) => ({
      byDocument: {},
      rememberReadingPosition: (key, position) =>
        set((s) => {
          if (!key) return s
          const window = screenplayPageWindow(position.sheet, position.totalSheets)
          const next: ScreenplayReadingPosition = {
            ...position,
            windowStart: window.start,
            windowEnd: window.end,
            updatedAt: Date.now(),
          }
          const previous = s.byDocument[key]
          // Scrolling fires this constantly; an identical position must not churn subscribers.
          if (
            previous &&
            previous.sheet === next.sheet &&
            previous.totalSheets === next.totalSheets &&
            Math.abs(previous.ratio - next.ratio) < 0.001 &&
            Math.abs(previous.scrollTopLayoutPx - next.scrollTopLayoutPx) < 1
          ) {
            return s
          }
          return { byDocument: withinCap({ ...s.byDocument, [key]: next }) }
        }),
      forgetReadingPosition: (key) =>
        set((s) => {
          if (!(key in s.byDocument)) return s
          const next = { ...s.byDocument }
          delete next[key]
          return { byDocument: next }
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ byDocument: state.byDocument }),
      /** Stale entries are dropped on the way in, so nothing ever restores to a forgotten page. */
      merge: (persisted, current) => {
        const stored = (persisted as { byDocument?: Record<string, ScreenplayReadingPosition> })
          ?.byDocument
        if (!stored || typeof stored !== 'object') return current
        const cutoff = Date.now() - POSITION_MAX_AGE_MS
        const fresh = Object.entries(stored).filter(
          ([, position]) => (position?.updatedAt ?? 0) >= cutoff,
        )
        return { ...current, byDocument: withinCap(Object.fromEntries(fresh)) }
      },
    },
  ),
)

/**
 * Imperative read for event handlers and one-shot restore effects.
 *
 * Deliberately not a selector hook: the position changes on every scroll, and a component that
 * subscribed to it would re-render the whole editor as the reader moves through the script.
 */
export function readScreenplayReadingPosition(
  key: string | undefined,
): ScreenplayReadingPosition | null {
  if (!key) return null
  const position = useScreenplayReadingPositionStore.getState().byDocument[key]
  if (!position || !Number.isFinite(position.sheet)) return null
  return Date.now() - (position.updatedAt ?? 0) <= POSITION_MAX_AGE_MS ? position : null
}

/** Imperative write, for the same reason. */
export function rememberScreenplayReadingPosition(
  key: string | undefined,
  position: ScreenplayReadingPositionInput,
): void {
  if (!key) return
  useScreenplayReadingPositionStore.getState().rememberReadingPosition(key, position)
}
