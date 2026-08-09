/**
 * Per-document screenplay layout inference + application.
 *
 * Imported PDF screenplays may be typeset with a slightly condensed Courier than Writual's WGA
 * default (6.0" text area, 10 CPI). When the parser reflows wrapped PDF rows into a single block,
 * the editor re-wraps at its own width, producing extra lines and pagination drift. To match the
 * source, we measure the source's per-element indents/column-widths at import time and store a
 * `ScreenplayLayoutConfig`, then apply it at render time as inline CSS custom properties on the
 * `.screenplay-page` element.
 *
 * The right margin is intentionally NOT part of this per-document inference: WGA format fixes it
 * at 1.0" (ragged, never justified) regardless of how a source PDF was typeset, so Writual always
 * renders at `SCREENPLAY_MARGIN_RIGHT_PX` — never a narrower, source-measured value.
 *
 * IMPORTANT: the on-screen page stays exactly 8.5" × 11" (816 × 1056 px). Only element indents and
 * centered-element right pads change; the text-area width/right margin are always the WGA default.
 */

import {
  SCREENPLAY_PAPER_WIDTH_PX,
  SCREENPLAY_MARGIN_LEFT_PX,
  SCREENPLAY_MARGIN_RIGHT_PX,
  SCREENPLAY_TEXT_AREA_WIDTH_PX,
  SCREENPLAY_DIALOGUE_INDENT_PX,
  SCREENPLAY_DIALOGUE_RIGHT_PAD_PX,
  SCREENPLAY_PARENTHETICAL_INDENT_PX,
  SCREENPLAY_PARENTHETICAL_RIGHT_PAD_PX,
  SCREENPLAY_CHARACTER_INDENT_PX,
} from '@/components/ScreenplayEditor/screenplayPaperLayout'

/** Inferred per-document layout overrides. All fields optional; absent ⇒ use the WGA default. */
export interface ScreenplayLayoutConfig {
  /** Dialogue left indent (offset from text-area left), px @96dpi. */
  dialogueIndentPx?: number
  /** Parenthetical left indent (offset from text-area left), px @96dpi. */
  parentheticalIndentPx?: number
  /** Character cue left indent (offset from text-area left), px @96dpi. */
  characterIndentPx?: number
  /** Dialogue text-column width (px @96dpi), measured from source; absent ⇒ WGA default (344). */
  dialogueTextWidthPx?: number
  /** Parenthetical text-column width (px @96dpi), measured from source; absent ⇒ WGA default (192). */
  parentheticalTextWidthPx?: number
  /** Estimated source characters-per-inch (informational; not applied). */
  sourceCpi?: number
  /** True when produced from real measurement (vs. defaults). */
  measured?: boolean
}

export const PT_PER_INCH = 72
export const PX_PER_INCH = 96

export function inchToPx(inches: number): number {
  return inches * PX_PER_INCH
}

/** PDF user-space points → CSS px @96dpi. */
export function ptToPx(pt: number): number {
  return (pt * PX_PER_INCH) / PT_PER_INCH
}

/**
 * Dialogue/parenthetical text-column widths in the default layout. Centered elements keep these
 * absolute widths even when their indent shifts (we recompute their right pad to compensate).
 */
const DIALOGUE_TEXT_WIDTH_PX =
  SCREENPLAY_TEXT_AREA_WIDTH_PX - SCREENPLAY_DIALOGUE_INDENT_PX - SCREENPLAY_DIALOGUE_RIGHT_PAD_PX // 344
const PARENTHETICAL_TEXT_WIDTH_PX =
  SCREENPLAY_TEXT_AREA_WIDTH_PX -
  SCREENPLAY_PARENTHETICAL_INDENT_PX -
  SCREENPLAY_PARENTHETICAL_RIGHT_PAD_PX // 192

/** Indents must stay within the page content box (left margin → before the fixed WGA right margin). */
const MIN_INDENT_PX = 0
const MAX_INDENT_PX = SCREENPLAY_PAPER_WIDTH_PX - SCREENPLAY_MARGIN_LEFT_PX - SCREENPLAY_MARGIN_RIGHT_PX

/** Dialogue column width clamp (px @96dpi): ~2.5"–4.5". Guards against a mis-measured right edge. */
const MIN_DIALOGUE_WIDTH_PX = 240
const MAX_DIALOGUE_WIDTH_PX = 432
/** Parenthetical column width clamp (px @96dpi): ~1.0"–3.0". (Parentheticals are noisy/sparse.) */
const MIN_PARENTHETICAL_WIDTH_PX = 96
const MAX_PARENTHETICAL_WIDTH_PX = 288

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(max, Math.max(min, value))
}

/**
 * Sanitize a (possibly untrusted, from-DB) layout config: drop non-finite values and clamp every
 * field to a safe range so a mis-measured PDF can never produce a broken page. Returns `null` when
 * nothing usable remains (caller then falls back to the WGA default).
 */
export function clampLayoutConfig(
  raw: ScreenplayLayoutConfig | null | undefined,
): ScreenplayLayoutConfig | null {
  if (!raw || typeof raw !== 'object') return null

  const out: ScreenplayLayoutConfig = {}
  // `actionRightMarginPx` is intentionally not read here: any legacy stored value (from a project
  // imported before this fix) is discarded so the right margin always renders at the fixed WGA
  // 1.0" default, never a source-measured override — see module docstring.

  const dialogue = clampNumber(raw.dialogueIndentPx, MIN_INDENT_PX, MAX_INDENT_PX)
  if (dialogue != null) out.dialogueIndentPx = Math.round(dialogue)

  const paren = clampNumber(raw.parentheticalIndentPx, MIN_INDENT_PX, MAX_INDENT_PX)
  if (paren != null) out.parentheticalIndentPx = Math.round(paren)

  const character = clampNumber(raw.characterIndentPx, MIN_INDENT_PX, MAX_INDENT_PX)
  if (character != null) out.characterIndentPx = Math.round(character)

  const dlgWidth = clampNumber(raw.dialogueTextWidthPx, MIN_DIALOGUE_WIDTH_PX, MAX_DIALOGUE_WIDTH_PX)
  if (dlgWidth != null) out.dialogueTextWidthPx = Math.round(dlgWidth)

  const parenWidth = clampNumber(
    raw.parentheticalTextWidthPx,
    MIN_PARENTHETICAL_WIDTH_PX,
    MAX_PARENTHETICAL_WIDTH_PX,
  )
  if (parenWidth != null) out.parentheticalTextWidthPx = Math.round(parenWidth)

  if (typeof raw.sourceCpi === 'number' && Number.isFinite(raw.sourceCpi)) {
    out.sourceCpi = raw.sourceCpi
  }
  if (raw.measured === true) out.measured = true

  return Object.keys(out).length > 0 ? out : null
}

/** ── PDF measurement → layout inference ──────────────────────────────────────
 * Convert raw per-element measurements (PDF points) from `parseScreenplayPdf` into a clamped
 * `ScreenplayLayoutConfig`. Centralizes all px constants so the parser stays free of layout magic.
 */

/** Sample PDF must look like portrait US Letter (612 × 792 pt) before we trust its geometry. */
const LETTER_WIDTH_PT_MIN = 600
const LETTER_WIDTH_PT_MAX = 624
const LETTER_HEIGHT_PT_MIN = 780
const LETTER_HEIGHT_PT_MAX = 804
/** Minimum measured action lines before inferring a width (avoids noise on short/odd pages). */
const MIN_ACTION_LINES_FOR_INFERENCE = 5
/** ~½ char headroom for centered columns only; action width matches source edge for pagination parity. */
const COLUMN_WIDTH_SAFETY_PX = 4.8

export interface ScreenplayPdfMeasurements {
  pageWidthPt: number
  pageHeightPt: number
  /** Document's calibrated action-column left edge (pt) from `findBaseX()` — the reference point
   * all other indents below are measured relative to. Source PDFs don't all share the WGA default
   * 108pt left margin, so indents must be computed against the document's own baseX, not a constant. */
  baseXPt: number
  /** Max right edge (pt) across action/slugline lines, or null if none measured. */
  actionRightMaxPt: number | null
  actionLineCount: number
  /** Median left x (pt) per element type, or null if not measured. */
  dialogueLeftPt: number | null
  parentheticalLeftPt: number | null
  characterLeftPt: number | null
  /** Max right edge (pt) per centered column, or null if not measured. Used to derive column width. */
  dialogueRightMaxPt: number | null
  parentheticalRightMaxPt: number | null
}

function offsetIndentPx(leftPt: number | null, baseXPt: number): number | undefined {
  if (leftPt == null || !Number.isFinite(leftPt)) return undefined
  // Indent is expressed as an offset from the document's own calibrated left margin (baseX), not
  // the fixed WGA constant — a PDF with a narrower/wider action margin still gets correct indents.
  return ptToPx(leftPt - baseXPt)
}

/**
 * Produce a clamped layout config from measurements, or null when the source doesn't look like a
 * standard portrait Letter page or we measured too few action lines to trust the width.
 */
export function inferLayoutFromPdfMeasurements(
  m: ScreenplayPdfMeasurements,
): ScreenplayLayoutConfig | null {
  const isLetterPortrait =
    m.pageWidthPt >= LETTER_WIDTH_PT_MIN &&
    m.pageWidthPt <= LETTER_WIDTH_PT_MAX &&
    m.pageHeightPt >= LETTER_HEIGHT_PT_MIN &&
    m.pageHeightPt <= LETTER_HEIGHT_PT_MAX
  if (!isLetterPortrait) return null
  if (m.actionLineCount < MIN_ACTION_LINES_FOR_INFERENCE || m.actionRightMaxPt == null) return null

  const cfg: ScreenplayLayoutConfig = { measured: true }

  // WGA format fixes the right margin at 1.0" (ragged, never justified) regardless of how the
  // source PDF was typeset, so — unlike the indents below — it is never inferred from measurement;
  // `applyLayoutConfigToPage` always renders it at `SCREENPLAY_MARGIN_RIGHT_PX`.

  const dialogueIndent = offsetIndentPx(m.dialogueLeftPt, m.baseXPt)
  if (dialogueIndent != null) cfg.dialogueIndentPx = Math.round(dialogueIndent)
  const parentheticalIndent = offsetIndentPx(m.parentheticalLeftPt, m.baseXPt)
  if (parentheticalIndent != null) cfg.parentheticalIndentPx = Math.round(parentheticalIndent)
  const characterIndent = offsetIndentPx(m.characterLeftPt, m.baseXPt)
  if (characterIndent != null) cfg.characterIndentPx = Math.round(characterIndent)

  // Dialogue/parenthetical column width = measured right edge − measured left + ~1-char headroom, so
  // the source's longest line never wraps in the matched box. Missing measurements ⇒ omit (default).
  if (m.dialogueRightMaxPt != null && m.dialogueLeftPt != null) {
    cfg.dialogueTextWidthPx = Math.round(
      ptToPx(m.dialogueRightMaxPt) - ptToPx(m.dialogueLeftPt) + COLUMN_WIDTH_SAFETY_PX,
    )
  }
  if (m.parentheticalRightMaxPt != null && m.parentheticalLeftPt != null) {
    cfg.parentheticalTextWidthPx = Math.round(
      ptToPx(m.parentheticalRightMaxPt) - ptToPx(m.parentheticalLeftPt) + COLUMN_WIDTH_SAFETY_PX,
    )
  }

  return clampLayoutConfig(cfg)
}

/** Median of a numeric array, or null when empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/** CSS custom properties this module manages on `.screenplay-page` (for set/reset). Right margin
 * (`--sp-margin-right`) is deliberately absent: it always stays at the CSS/WGA default (1.0"). */
const MANAGED_PROPS = [
  '--sp-dialogue-indent',
  '--sp-parenthetical-indent',
  '--sp-character-indent',
  '--sp-dialogue-right-pad',
  '--sp-parenthetical-right-pad',
] as const

/** Remove all inline overrides this module may have set, restoring the CSS defaults. */
export function resetLayoutConfigOnPage(pageEl: HTMLElement | null): void {
  if (!pageEl) return
  for (const prop of MANAGED_PROPS) pageEl.style.removeProperty(prop)
}

/**
 * Apply a (already-clamped) layout config as inline CSS custom properties on the `.screenplay-page`
 * element. Idempotent; sets only inline styles (no protected-source edits) and never changes the
 * paper width or right margin (fixed WGA 1.0"). When `cfg` is null, this resets to defaults.
 *
 * `--sp-dialogue-right-pad` / `--sp-parenthetical-right-pad` are recomputed from the target column
 * width — the measured source width (`cfg.dialogueTextWidthPx` / `cfg.parentheticalTextWidthPx`)
 * when present, else the WGA default (344px / 192px) — against the fixed WGA text-area width, so
 * dialogue/parenthetical keep their absolute widths regardless of indent.
 */
export function applyLayoutConfigToPage(
  pageEl: HTMLElement | null,
  cfg: ScreenplayLayoutConfig | null,
): void {
  if (!pageEl) return
  if (!cfg) {
    resetLayoutConfigOnPage(pageEl)
    return
  }

  const dialogueIndent = cfg.dialogueIndentPx ?? SCREENPLAY_DIALOGUE_INDENT_PX
  const parentheticalIndent = cfg.parentheticalIndentPx ?? SCREENPLAY_PARENTHETICAL_INDENT_PX

  // Use the measured source column width when available so the editor re-wraps exactly like the
  // source PDF (eliminating pagination drift); otherwise keep the WGA default absolute width.
  const dialogueWidth = cfg.dialogueTextWidthPx ?? DIALOGUE_TEXT_WIDTH_PX
  const parentheticalWidth = cfg.parentheticalTextWidthPx ?? PARENTHETICAL_TEXT_WIDTH_PX

  const dialogueRightPad = SCREENPLAY_TEXT_AREA_WIDTH_PX - dialogueIndent - dialogueWidth
  const parentheticalRightPad = SCREENPLAY_TEXT_AREA_WIDTH_PX - parentheticalIndent - parentheticalWidth

  const set = (prop: string, value: number | undefined) => {
    if (value == null || !Number.isFinite(value)) {
      pageEl.style.removeProperty(prop)
    } else {
      pageEl.style.setProperty(prop, `${value}px`)
    }
  }

  set('--sp-dialogue-indent', cfg.dialogueIndentPx)
  set('--sp-parenthetical-indent', cfg.parentheticalIndentPx)
  set('--sp-character-indent', cfg.characterIndentPx)
  // Right pads are always recomputed so centered columns keep their absolute widths.
  set('--sp-dialogue-right-pad', Math.max(0, dialogueRightPad))
  set('--sp-parenthetical-right-pad', Math.max(0, parentheticalRightPad))
}
