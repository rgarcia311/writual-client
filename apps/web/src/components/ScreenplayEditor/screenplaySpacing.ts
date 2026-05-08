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

const ZERO_GAP_KEYS = new Set<string>([
  'character|parenthetical',
  'character|dialogue',
  'parenthetical|dialogue',
])

/** Prev types that get **two** blanks (1/3") before a `slugline` (CSV “1 sometimes 2” — we use full 1/3"). */
const DOUBLE_BLANK_BEFORE_SLUGLINE_PREV = new Set<ScreenplayElementType>([
  'action',
  'dialogue',
  'transition',
])

/**
 * Vertical gap **between** two consecutive script blocks (inches), before rendering `next`.
 *
 * Cue chain (0"): Character→Parenthetical, Character→Dialogue, Parenthetical→Dialogue.
 *
 * **1/3"** (two blanks): Action / Dialogue / **Transition** → Scene Heading (`slugline`).
 *
 * Elsewhere default is **1/6"** unless a pair above applies.
 */
export function getScreenplayInterBlockGapInches(
  prev: ScreenplayElementType | null,
  next: ScreenplayElementType,
): number {
  if (prev == null) return 0
  if (ZERO_GAP_KEYS.has(`${prev}|${next}`)) return 0
  if (next === 'slugline' && DOUBLE_BLANK_BEFORE_SLUGLINE_PREV.has(prev)) {
    return SCREENPLAY_TWO_BLANKS_INCHES
  }
  return SCREENPLAY_ONE_BLANK_INCHES
}
