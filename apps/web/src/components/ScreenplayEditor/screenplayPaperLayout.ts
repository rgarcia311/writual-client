/**
 * US Letter screenplay layout at 96 CSS px per inch (width).
 * Paper is exactly 8.5" x 11". Keep in sync with `Screenplay.css`.
 */
export const SCREENPLAY_PAPER_WIDTH_PX = 576 + 144 + 96 // 816 — 6" text + 1.5" + 1" side margins

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

/** Visible grey gap between sheets on screen — must match `.page-break-gap__gap` */
export const SCREENPLAY_INTER_PAGE_GAP_PX = 48

/** 12pt Courier at 96dpi — inline break search in PageBreakPlugin */
export const SCREENPLAY_LINE_HEIGHT_PX = 16