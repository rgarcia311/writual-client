import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getScreenplayInterBlockGapInches } from './screenplaySpacing'
import type { ScreenplayElementType } from './ScreenplayExtension'

/**
 * Cross-references `getScreenplayInterBlockGapInches` (used by the PDF export/print path) against
 * the per-element-type CSS padding rules in `Screenplay.css`, so future drift between the two
 * hand-maintained sources of truth is caught immediately instead of silently.
 *
 * The expected-px table below is hand-derived from `Screenplay.css` (not scraped — a regex-based
 * CSS parser would itself be a second fragile source to maintain for a fixed 6x6 table). Update
 * both together when either changes:
 *   - Base `.script-block` padding-top/bottom: 0 (lines 243-244).
 *   - Per-type padding-bottom overrides: action/dialogue/transition/slugline = 16px (one blank
 *     line); character/parenthetical = 0px (lines 339, 383, 447, 297, 354, 366).
 *   - `padding-top` overrides via `:has(> [type=X]) + .node-scriptBlock > [type=slugline|transition]`:
 *     slugline gets +16px when prev is character/parenthetical/action/dialogue/transition
 *     (lines 305-320); transition gets +16px when prev is character/parenthetical (lines 452-459).
 */

const BODY_TYPES: ScreenplayElementType[] = [
  'action',
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
]

const PREV_BOTTOM_PX: Record<ScreenplayElementType, number> = {
  action: 16,
  slugline: 16,
  character: 0,
  parenthetical: 0,
  dialogue: 16,
  transition: 16,
  title: 16,
  author: 16,
  contact: 16,
}

/** `next` type -> set of `prev` types that add a 16px `padding-top` override. */
const NEXT_TOP_OVERRIDE_PREVS: Partial<Record<ScreenplayElementType, Set<ScreenplayElementType>>> = {
  slugline: new Set<ScreenplayElementType>(['character', 'parenthetical', 'action', 'dialogue', 'transition']),
  transition: new Set<ScreenplayElementType>(['character', 'parenthetical']),
}

function expectedGapPx(prev: ScreenplayElementType, next: ScreenplayElementType): number {
  const topOverride = NEXT_TOP_OVERRIDE_PREVS[next]?.has(prev) ? 16 : 0
  return PREV_BOTTOM_PX[prev] + topOverride
}

describe('getScreenplayInterBlockGapInches matches Screenplay.css', () => {
  for (const prev of BODY_TYPES) {
    for (const next of BODY_TYPES) {
      it(`${prev} -> ${next}`, () => {
        const actualPx = getScreenplayInterBlockGapInches(prev, next) * 96
        assert.equal(actualPx, expectedGapPx(prev, next))
      })
    }
  }
})

describe('getScreenplayInterBlockGapInches edge cases', () => {
  it('returns 0 for a null prev (first block in the document)', () => {
    assert.equal(getScreenplayInterBlockGapInches(null, 'action'), 0)
  })
})
