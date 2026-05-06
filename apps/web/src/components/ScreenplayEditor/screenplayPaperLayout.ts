// <PROTECTED>
/**
 * US Letter screenplay layout at 96 CSS px per inch (width).
 * Paper is exactly 8.5" x 11". Keep in sync with `Screenplay.css`.
 */
export const SCREENPLAY_PAPER_WIDTH_PX = 576 + 144 + 96 // 816 — 6" text + 1.5" + 1" side margins

/**
 * Horizontal inset inside the editor column (toolbar + scroll inner).
 * Right is slightly larger so lateral `box-shadow` survives the scrollport edge / scrollbar.
 */
export const SCREENPLAY_SCROLL_GUTTER_LEFT_PX = 28
/** Tight to scrollbar; keep ≥ ~8px so page rim shadow isn’t clipped by scrollport */
export const SCREENPLAY_SCROLL_GUTTER_RIGHT_PX = 12

/** Editor column: paper width + horizontal gutters */
export const SCREENPLAY_EDITOR_COLUMN_WIDTH_PX =
  SCREENPLAY_PAPER_WIDTH_PX + SCREENPLAY_SCROLL_GUTTER_LEFT_PX + SCREENPLAY_SCROLL_GUTTER_RIGHT_PX

/** 11 inches at 96dpi = 1056px */
export const SCREENPLAY_PAPER_HEIGHT_PX = 1056

/** In sync with `.screenplay-page` in `Screenplay.css` (WGA + StudioBinder 96dpi model). */
export const SCREENPLAY_MARGIN_TOP_PX = 96
export const SCREENPLAY_MARGIN_BOTTOM_PX = 96
export const SCREENPLAY_MARGIN_LEFT_PX = 144
export const SCREENPLAY_MARGIN_RIGHT_PX = 96
export const SCREENPLAY_TEXT_AREA_WIDTH_PX = 576
export const SCREENPLAY_DIALOGUE_INDENT_PX = 96
export const SCREENPLAY_DIALOGUE_RIGHT_PAD_PX = 136
export const SCREENPLAY_PARENTHETICAL_INDENT_PX = 154
export const SCREENPLAY_PARENTHETICAL_RIGHT_PAD_PX = 230
export const SCREENPLAY_CHARACTER_INDENT_PX = 211
export const SCREENPLAY_GUTTER_BLEED_PX = 36

/** Yields exactly 864px (fits exactly 54 lines of 12pt Courier) */
export const SCREENPLAY_CONTENT_HEIGHT_PX =
  SCREENPLAY_PAPER_HEIGHT_PX - SCREENPLAY_MARGIN_TOP_PX - SCREENPLAY_MARGIN_BOTTOM_PX

/** Inter-page gap height on screen — must match `.page-break-gap__gap` / `--sp-inter-page-gap` */
export const SCREENPLAY_INTER_PAGE_GAP_PX = 28

/** 12pt Courier at 96dpi — inline break search in PageBreakPlugin */
export const SCREENPLAY_LINE_HEIGHT_PX = 16

/**
 * Preferred on-screen display scale: renders the 816 × 1056 px canonical paper
 * as a 709 × 917 px visual page (8.5 × 11" at 1 : 1.294 aspect ratio).
 * Used as the cap and reset target for the auto-fit zoom in WritualEditor.
 */
export const SCREENPLAY_DISPLAY_SCALE = 709 / SCREENPLAY_PAPER_WIDTH_PX

/**
 * Shared box-shadow for floating screenplay surfaces whose outward-facing edge is on the RIGHT
 * (screenplay page, side panel list). Three-sided rim: right, top, bottom.
 */
export const SCREENPLAY_FLOATING_SURFACE_SHADOW =
  '3px 0 12px -6px rgba(0, 0, 0, 0.2), 0 -3px 12px -6px rgba(0, 0, 0, 0.2), 0 8px 12px -6px rgba(0, 0, 0, 0.2)'

/**
 * Box-shadow for the vertical document toolbar, which sits to the LEFT of the screenplay page.
 * Mirrors SCREENPLAY_FLOATING_SURFACE_SHADOW: left edge instead of right, same top/bottom.
 */
export const SCREENPLAY_TOOLBAR_SHADOW =
  '-3px 0 12px -6px rgba(0, 0, 0, 0.2), 0 -3px 12px -6px rgba(0, 0, 0, 0.2), 0 8px 12px -6px rgba(0, 0, 0, 0.2)'
// </PROTECTED>