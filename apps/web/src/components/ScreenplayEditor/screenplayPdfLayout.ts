/**
 * Pure page geometry for the screenplay PDF export.
 *
 * Split out of `screenplayPdfPrint.ts` so the numbers that decide where ink lands — margins, the
 * in-line baseline offset, lines per page, per-element columns — can be asserted without pulling
 * in jsPDF or the Tiptap extension graph. Only `import type` crosses to `ScreenplayExtension`,
 * so this module is erased-imports-clean and runs under the plain node test runner.
 */

import type { ScreenplayElementType } from './ScreenplayExtension'
import {
  SCREENPLAY_CHARACTER_INDENT_PX,
  SCREENPLAY_DIALOGUE_INDENT_PX,
  SCREENPLAY_DIALOGUE_RIGHT_PAD_PX,
  SCREENPLAY_MARGIN_LEFT_PX,
  SCREENPLAY_PARENTHETICAL_INDENT_PX,
  SCREENPLAY_PARENTHETICAL_RIGHT_PAD_PX,
  SCREENPLAY_TEXT_AREA_WIDTH_PX,
} from './screenplayPaperLayout'
import type { ScreenplayLayoutConfig } from '@/lib/screenplayLayout'

/** @see screenplaySpacing.ts — 12pt line = 1/6" */
export const TOP_CONTENT_IN = 1.0

/**
 * Vertical offset from a 12pt line box’s top edge down to its baseline.
 *
 * jsPDF’s `doc.text(s, x, y)` positions the **baseline** at `y`, so writing the first line at
 * `TOP_CONTENT_IN` put the glyph tops at ~0.89" and floated the entire page 8pt high — measurably
 * so: reference screenplay exports place their first baseline at 1.111" (= 1.0" margin + 8pt),
 * ours landed at exactly 1.000". Every `doc.text()` call in this module therefore draws at
 * `baseline(line)` / `<top> + BASELINE_OFFSET_IN` rather than at the raw margin.
 *
 * The value is the measured metric for 12pt Courier on a 12pt (1/6") line grid, not jsPDF’s
 * `{ baseline: \'top\' }` — that derives its shift from the embedded font’s ascender, which does
 * not land on 8pt for Courier Prime.
 */
export const BASELINE_OFFSET_IN = 8 / 72

/** Baseline of the first body line on a page (1.0" top margin + the in-line baseline offset). */
export const FIRST_BASELINE_IN = TOP_CONTENT_IN + BASELINE_OFFSET_IN

/** 11" page − 1" top − 1" bottom = 9" of type at 1/6" per line. */
export const LINES_PER_PAGE = 54

/** Page number: 0.5" from the paper top, right-aligned on the 1.0" right margin. */
export const PAGE_NUM_BASELINE_IN = 0.5 + BASELINE_OFFSET_IN

/** Title page: title block start and contact block start, as line-box tops. */
export const TITLE_BLOCK_TOP_IN = 3.5
export const CONTACT_BLOCK_TOP_IN = 9.0

/**
 * Never strand fewer than this many lines on either side of a mid-block page split.
 * Mirrors `MIN_LINES_BEFORE_SPLIT` / `MIN_LINES_AFTER_SPLIT` in `PageBreakPlugin.ts`.
 */
export const MIN_LINES_BEFORE_SPLIT = 2
export const MIN_LINES_AFTER_SPLIT = 2

/** Types whose mid-block page split gets "(MORE)" + "NAME (CONT\'D)" continuation markers. */
export const SPLIT_WITH_MORE_TYPES = new Set<ScreenplayElementType>(['dialogue', 'parenthetical'])

export const TITLE_PAGE_TYPES_PDF = new Set<ScreenplayElementType>(['title', 'author', 'contact'])

const PX_PER_INCH = 96
const pxToIn = (px: number) => px / PX_PER_INCH

/** Text-area left edge / width in inches — the same constants the editor lays the page out from. */
export const TEXT_LEFT_IN = pxToIn(SCREENPLAY_MARGIN_LEFT_PX)
export const TEXT_WIDTH_IN = pxToIn(SCREENPLAY_TEXT_AREA_WIDTH_PX)
export const TEXT_RIGHT_IN = TEXT_LEFT_IN + TEXT_WIDTH_IN

/**
 * Title-page contact block: 1.0" from the paper's left edge, i.e. hanging 0.5" outside the 1.5"
 * text area and into the page's left margin. Measured off reference exports (x = 72pt); the block
 * is deliberately not aligned to the body text column.
 */
export const CONTACT_LEFT_IN = 1.0

export interface PdfElementSpec {
  x: number
  w: number
  rightEdge?: number
  oneLine?: boolean
}

export type PdfLayout = Record<ScreenplayElementType, PdfElementSpec>

/**
 * Element geometry in inches, derived from the shared px constants in `screenplayPaperLayout.ts`
 * overlaid with this document’s inferred `ScreenplayLayoutConfig` — the same two inputs
 * `applyLayoutConfigToPage()` renders the on-screen page from.
 *
 * This used to be a hardcoded table, which meant an imported script whose measured character-cue
 * indent was 3.5" still printed at the WGA default 3.7": the export was the one renderer that never
 * saw the config. Deriving both from one place keeps the PDF and the editor from drifting apart.
 *
 * The action column keeps the fixed WGA 6.0" measure (1.5" → 7.5", ragged right) regardless of the
 * source’s own margin — same rule `screenplayLayout.ts` applies on screen, and why the config has
 * no action-width field to read.
 */
export function buildPdfLayout(cfg: ScreenplayLayoutConfig | null): PdfLayout {
  const dialogueIndentPx = cfg?.dialogueIndentPx ?? SCREENPLAY_DIALOGUE_INDENT_PX
  const parentheticalIndentPx = cfg?.parentheticalIndentPx ?? SCREENPLAY_PARENTHETICAL_INDENT_PX
  const characterIndentPx = cfg?.characterIndentPx ?? SCREENPLAY_CHARACTER_INDENT_PX

  const dialogueWidthPx =
    cfg?.dialogueTextWidthPx ??
    SCREENPLAY_TEXT_AREA_WIDTH_PX - SCREENPLAY_DIALOGUE_INDENT_PX - SCREENPLAY_DIALOGUE_RIGHT_PAD_PX
  const parentheticalWidthPx =
    cfg?.parentheticalTextWidthPx ??
    SCREENPLAY_TEXT_AREA_WIDTH_PX -
      SCREENPLAY_PARENTHETICAL_INDENT_PX -
      SCREENPLAY_PARENTHETICAL_RIGHT_PAD_PX

  const fullWidth = { x: TEXT_LEFT_IN, w: TEXT_WIDTH_IN }

  return {
    title: fullWidth,
    author: fullWidth,
    contact: { x: CONTACT_LEFT_IN, w: TEXT_RIGHT_IN - CONTACT_LEFT_IN },
    action: fullWidth,
    slugline: fullWidth,
    character: {
      x: TEXT_LEFT_IN + pxToIn(characterIndentPx),
      w: TEXT_WIDTH_IN - pxToIn(characterIndentPx),
      oneLine: true,
    },
    parenthetical: {
      x: TEXT_LEFT_IN + pxToIn(parentheticalIndentPx),
      w: pxToIn(parentheticalWidthPx),
    },
    dialogue: {
      x: TEXT_LEFT_IN + pxToIn(dialogueIndentPx),
      w: pxToIn(dialogueWidthPx),
    },
    transition: { x: 5.5, w: 2.0, rightEdge: TEXT_RIGHT_IN },
  }
}

/**
 * Read the live per-document layout off `.screenplay-page`’s inline CSS custom properties.
 *
 * `applyLayoutConfigToPage()` writes the project’s inferred config there, so this is the same
 * geometry the user is looking at — printing what is on screen rather than a second, independent
 * guess at it. Returns `null` when the page isn’t mounted (headless/test callers), which falls
 * back to the WGA defaults. Callers holding the config directly should pass it instead.
 */
export function readLayoutConfigFromPage(): ScreenplayLayoutConfig | null {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null
  const pageEl = document.querySelector<HTMLElement>('.screenplay-page')
  if (!pageEl) return null

  const cs = getComputedStyle(pageEl)
  const read = (prop: string): number | undefined => {
    const v = Number.parseFloat(cs.getPropertyValue(prop))
    return Number.isFinite(v) ? v : undefined
  }

  const dialogueIndentPx = read('--sp-dialogue-indent')
  const parentheticalIndentPx = read('--sp-parenthetical-indent')
  const characterIndentPx = read('--sp-character-indent')
  const dialogueRightPad = read('--sp-dialogue-right-pad')
  const parentheticalRightPad = read('--sp-parenthetical-right-pad')

  const cfg: ScreenplayLayoutConfig = {}
  if (dialogueIndentPx != null) cfg.dialogueIndentPx = dialogueIndentPx
  if (parentheticalIndentPx != null) cfg.parentheticalIndentPx = parentheticalIndentPx
  if (characterIndentPx != null) cfg.characterIndentPx = characterIndentPx
  // Column widths are stored on the page as right pads against the fixed text-area width; invert
  // that here so `buildPdfLayout` deals only in widths (mirrors `applyLayoutConfigToPage`).
  if (dialogueIndentPx != null && dialogueRightPad != null) {
    cfg.dialogueTextWidthPx = SCREENPLAY_TEXT_AREA_WIDTH_PX - dialogueIndentPx - dialogueRightPad
  }
  if (parentheticalIndentPx != null && parentheticalRightPad != null) {
    cfg.parentheticalTextWidthPx =
      SCREENPLAY_TEXT_AREA_WIDTH_PX - parentheticalIndentPx - parentheticalRightPad
  }

  return Object.keys(cfg).length > 0 ? cfg : null
}
