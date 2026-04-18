/**
 * US Letter screenplay layout at 96 CSS px per inch (width).
 * On-screen sheet height follows width × 1.29 (8.5×11 proportion); keep in sync with `Screenplay.css`.
 */
export const SCREENPLAY_PAPER_WIDTH_PX = 576 + 144 + 96 // 816 — 6" text + 1.5" + 1" side margins
/** Integer height = round(816 × 1.29); must match `--sp-paper-height` in Screenplay.css */
export const SCREENPLAY_PAPER_HEIGHT_PX = Math.round(SCREENPLAY_PAPER_WIDTH_PX * 1.29)
export const SCREENPLAY_MARGIN_TOP_PX = 96
export const SCREENPLAY_MARGIN_BOTTOM_PX = 96
export const SCREENPLAY_CONTENT_HEIGHT_PX =
  SCREENPLAY_PAPER_HEIGHT_PX - SCREENPLAY_MARGIN_TOP_PX - SCREENPLAY_MARGIN_BOTTOM_PX

/** Visible grey gap between sheets on screen — must match `.page-break-gap__gap` */
export const SCREENPLAY_INTER_PAGE_GAP_PX = 48

/** 12pt Courier at 96dpi — inline break search in PageBreakPlugin */
export const SCREENPLAY_LINE_HEIGHT_PX = 16
