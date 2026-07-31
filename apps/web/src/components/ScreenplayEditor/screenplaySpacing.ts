/**
 * Screenplay vertical spacing between script blocks (US Letter, 12pt Courier Prime line).
 *
 * Source: project reference CSV (“exact dimensions in inches between…”).
 * One blank line = 12pt = 12/72 in = **1/6"** (~0.167"). Two blank lines = **1/3"** (~0.333").
 */

import type { ScreenplayElementType } from './ScreenplayExtension'

/** Height of one 12pt line; also one CSV “blank line” of vertical gap (1/6"). */
export const SCREENPLAY_LINE_HEIGHT_INCHES = 12 / 72

/** Alias: one blank line between elements (1/6"). */
export const SCREENPLAY_ONE_BLANK_INCHES = SCREENPLAY_LINE_HEIGHT_INCHES

/** Two blank lines (1/3") — used before scene headings after action / dialogue / transition. */
export const SCREENPLAY_TWO_BLANKS_INCHES = 24 / 72

/**
 * Types whose own `padding-bottom` is 0 in `Screenplay.css` (character/parenthetical cue lines
 * carry no trailing blank line — the CSS applies this unconditionally, regardless of what follows).
 */
const ZERO_BOTTOM_PAD_TYPES = new Set<ScreenplayElementType>(['character', 'parenthetical'])

/** `next` type → prev types that get a `padding-top` override (mirrors `Screenplay.css`'s
 * `:has(> [type=X]) + .node-scriptBlock > [type=slugline|transition]` rules). */
const TOP_PAD_OVERRIDE_PREVS: Partial<Record<ScreenplayElementType, Set<ScreenplayElementType>>> = {
  slugline: new Set<ScreenplayElementType>(['character', 'parenthetical', 'action', 'dialogue', 'transition']),
  transition: new Set<ScreenplayElementType>(['character', 'parenthetical']),
}

/**
 * Vertical gap **between** two consecutive script blocks (inches), before rendering `next`.
 *
 * Mirrors the CSS cascade in `Screenplay.css` exactly: `gap = prev's padding-bottom + next's
 * padding-top override (if any)`, in one-blank-line (1/6") units:
 *
 * - Character / Parenthetical carry no trailing blank line (their `padding-bottom` is always 0),
 *   so anything following them gets **0"** unless `next` also has a top-pad override (below).
 * - Scene Heading (`slugline`) gets **+1/6"** `padding-top` when `prev` is
 *   character/parenthetical/action/dialogue/transition — combined with the prev-bottom rule above,
 *   this yields **1/3"** (two blanks) after action/dialogue/transition, and **1/6"** (one blank)
 *   after character/parenthetical (whose own bottom is 0).
 * - Transition gets **+1/6"** `padding-top` when `prev` is character/parenthetical.
 * - Elsewhere: **1/6"** (one blank) by default.
 */
export function getScreenplayInterBlockGapInches(
  prev: ScreenplayElementType | null,
  next: ScreenplayElementType,
): number {
  if (prev == null) return 0

  const prevBottomBlanks = ZERO_BOTTOM_PAD_TYPES.has(prev) ? 0 : 1
  const topOverrideBlanks = TOP_PAD_OVERRIDE_PREVS[next]?.has(prev) ? 1 : 0
  const totalBlanks = prevBottomBlanks + topOverrideBlanks

  return totalBlanks * SCREENPLAY_ONE_BLANK_INCHES
}
