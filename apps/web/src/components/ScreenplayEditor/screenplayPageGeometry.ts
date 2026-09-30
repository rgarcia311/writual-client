'use client'

import {
  SCREENPLAY_INTER_PAGE_GAP_PX,
  SCREENPLAY_MARGIN_TOP_PX,
  SCREENPLAY_PAPER_HEIGHT_PX,
} from './screenplayPaperLayout'

/**
 * Which sheet of the paginated stack a scroll offset is showing, and where a sheet sits.
 *
 * Everything here works in *layout* space measured from the top of the `.ProseMirror` column —
 * the same coordinate space `offsetTop` reports and `screenplaySnapshotCapture` already captures
 * in — so a position recorded at one zoom or window size replays correctly at another.
 *
 * A page is recorded as a sheet number plus a fraction of that sheet rather than as a raw pixel
 * offset. The pixel offset only means anything while the document paginates exactly as it did when
 * it was captured; a sheet number survives an edit made on another device, a font that loaded late,
 * or a layout override arriving with the server copy, all of which shift every offset after them.
 */

/** Top-to-top distance between consecutive sheets: the paper plus the visible inter-page gap. */
export const SCREENPLAY_PAGE_PITCH_PX = SCREENPLAY_PAPER_HEIGHT_PX + SCREENPLAY_INTER_PAGE_GAP_PX

/**
 * Pages kept either side of the reader's page — the "5 before and 5 after" of the local reading
 * window. Shared by the stored position and the paint cache so the two can never disagree about
 * which pages a revisit is able to show.
 */
export const SCREENPLAY_READING_WINDOW_RADIUS = 5

export interface ScreenplayPageAnchor {
  /** 1-based physical sheet, cover sheet included — the same numbering `--total-pages` counts. */
  sheet: number
  /** How far into that sheet the viewport's top edge sat: 0 at its top, 1 at the next sheet's top. */
  ratio: number
}

export interface ScreenplayPageWindow {
  /** First cached sheet, 1-based and inclusive. */
  start: number
  /** Last cached sheet, 1-based and inclusive. */
  end: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * `.screenplay-page` pads its content by the paper's top margin, so the ProseMirror column starts
 * one margin below sheet 1's top edge. Sheet boundaries are multiples of the pitch in *page*
 * space, which is what this shifts a column-space offset into.
 */
function paperYFromColumnY(columnY: number): number {
  return columnY + SCREENPLAY_MARGIN_TOP_PX
}

/**
 * Upper bound for a sheet number. A total below 1 means pagination has not reported one yet, in
 * which case there is nothing trustworthy to clamp against and the raw geometry is used as-is.
 */
function sheetCeiling(totalSheets: number): number {
  return Number.isFinite(totalSheets) && totalSheets >= 1
    ? Math.floor(totalSheets)
    : Number.POSITIVE_INFINITY
}

/** The sheet, and the fraction into it, shown at a layout-space offset down the ProseMirror column. */
export function pageAnchorFromColumnY(
  columnY: number,
  totalSheets: number,
): ScreenplayPageAnchor {
  const y = Math.max(0, paperYFromColumnY(Number.isFinite(columnY) ? columnY : 0))
  const sheet = clamp(Math.floor(y / SCREENPLAY_PAGE_PITCH_PX) + 1, 1, sheetCeiling(totalSheets))
  const ratio = clamp((y - (sheet - 1) * SCREENPLAY_PAGE_PITCH_PX) / SCREENPLAY_PAGE_PITCH_PX, 0, 1)
  return { sheet, ratio }
}

/** Inverse of `pageAnchorFromColumnY`: where to scroll the column to put that anchor at the top. */
export function columnYFromPageAnchor(
  anchor: ScreenplayPageAnchor,
  totalSheets: number,
): number {
  const sheet = clamp(Math.round(anchor.sheet) || 1, 1, sheetCeiling(totalSheets))
  const ratio = clamp(Number.isFinite(anchor.ratio) ? anchor.ratio : 0, 0, 1)
  return (sheet - 1 + ratio) * SCREENPLAY_PAGE_PITCH_PX - SCREENPLAY_MARGIN_TOP_PX
}

/** The reader's page plus `radius` sheets either side, clipped to the sheets that exist. */
export function screenplayPageWindow(
  sheet: number,
  totalSheets: number,
  radius: number = SCREENPLAY_READING_WINDOW_RADIUS,
): ScreenplayPageWindow {
  const ceiling = sheetCeiling(totalSheets)
  const centre = clamp(Math.round(sheet) || 1, 1, ceiling)
  const span = Math.max(0, Math.round(radius) || 0)
  return {
    start: Math.max(1, centre - span),
    end: Math.min(ceiling, centre + span),
  }
}

/**
 * Layout-space band of the ProseMirror column covered by a window of sheets, so a caller can
 * select exactly the blocks that fall on those pages.
 */
export function columnBoundsForPageWindow(window: ScreenplayPageWindow): {
  top: number
  bottom: number
} {
  return {
    top: columnYFromPageAnchor({ sheet: window.start, ratio: 0 }, 0),
    bottom: columnYFromPageAnchor({ sheet: window.end, ratio: 1 }, 0),
  }
}

/**
 * The page number a writer would say out loud. Sheet numbering counts the cover as sheet 1, but a
 * script's page 1 is the first sheet of body — the same offset `readScreenplayBodyPageCount`
 * subtracts from the sheet total.
 */
export function bodyPageFromSheet(sheet: number, hasCoverPage: boolean): number {
  const s = Math.max(1, Math.round(sheet) || 1)
  return hasCoverPage ? Math.max(0, s - 1) : s
}
