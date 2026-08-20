import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LINE_GRID_TOLERANCE_PX,
  layoutBottomExceedsPageContentEnd,
  layoutBottomForPaginationOverflow,
  transformScaleY,
  wholeLinesInSpan,
} from './screenplayPaginationGeometry'
import {
  SCREENPLAY_CONTENT_HEIGHT_PX,
  SCREENPLAY_INTER_PAGE_GAP_PX,
  SCREENPLAY_LINE_HEIGHT_PX,
  SCREENPLAY_MARGIN_BOTTOM_PX,
  SCREENPLAY_MARGIN_TOP_PX,
  SCREENPLAY_PAPER_HEIGHT_PX,
} from './screenplayPaperLayout'

const LINE = SCREENPLAY_LINE_HEIGHT_PX
const WIDGET_HEIGHT =
  SCREENPLAY_MARGIN_BOTTOM_PX + SCREENPLAY_INTER_PAGE_GAP_PX + SCREENPLAY_MARGIN_TOP_PX
const PAGE_PITCH = SCREENPLAY_CONTENT_HEIGHT_PX + WIDGET_HEIGHT

/**
 * The measurement noise these tolerances exist to absorb, taken from a headless-Chrome probe of
 * this app's own geometry (816px page, 1600 script blocks, `transform: scale(z)` on an ancestor):
 *
 *   - Round-tripping a block bottom through `getBoundingClientRect() / scale` lands within
 *     ~0.006px of the true layout value, and the error pattern *changes with the zoom* (it is
 *     exactly 0 at scales that are binary-exact, e.g. 1.0 and 0.75, and non-zero elsewhere).
 *   - Inferring the scale from `rect.height / offsetHeight` instead of the transform matrix adds a
 *     further systematic ~0.42px stretch by the bottom of a feature-length document, because
 *     `offsetHeight` is rounded to a whole pixel.
 *
 * With the previous 1e-3 epsilon, 227-617 of those 1600 block bottoms were misreported as using an
 * extra line — a different set at every zoom, which is what made the total page count depend on the
 * browser window size. At 0.5px the count was zero at every zoom tested.
 */
const OBSERVED_NOISE_PX = 0.006
const OBSERVED_SCALE_INFERENCE_BIAS_PX = 0.43

describe('layoutBottomExceedsPageContentEnd', () => {
  const start = 0
  const end = SCREENPLAY_CONTENT_HEIGHT_PX

  it('a block ending exactly on the last line of the page does not overflow', () => {
    assert.equal(layoutBottomExceedsPageContentEnd(end, end, start), false)
  })

  it('a block one full line past the page end overflows', () => {
    assert.equal(layoutBottomExceedsPageContentEnd(end + LINE, end, start), true)
  })

  it('sub-pixel measurement noise on an exactly-full page never reports an overflow', () => {
    for (const noise of [OBSERVED_NOISE_PX, OBSERVED_SCALE_INFERENCE_BIAS_PX, 0.499]) {
      assert.equal(
        layoutBottomExceedsPageContentEnd(end + noise, end, start),
        false,
        `bottom ${end + noise} must still fit`,
      )
    }
  })

  it('the tolerance stays far below a real extra line, so a genuine overflow is never masked', () => {
    assert.ok(LINE_GRID_TOLERANCE_PX < LINE / 2)
    assert.equal(layoutBottomExceedsPageContentEnd(end + LINE_GRID_TOLERANCE_PX * 2, end, start), true)
  })

  it('holds on later pages, where projected coordinates are largest', () => {
    // Page 70 of a feature-length script — the region where accumulated noise is worst.
    const pageStart = 69 * PAGE_PITCH
    const pageEnd = pageStart + SCREENPLAY_CONTENT_HEIGHT_PX
    assert.equal(layoutBottomExceedsPageContentEnd(pageEnd, pageEnd, pageStart), false)
    assert.equal(
      layoutBottomExceedsPageContentEnd(pageEnd + OBSERVED_SCALE_INFERENCE_BIAS_PX, pageEnd, pageStart),
      false,
    )
    assert.equal(layoutBottomExceedsPageContentEnd(pageEnd + LINE, pageEnd, pageStart), true)
  })

  it('a page holds exactly 54 lines', () => {
    assert.equal(SCREENPLAY_CONTENT_HEIGHT_PX / LINE, 54)
    assert.equal(layoutBottomExceedsPageContentEnd(54 * LINE, end, start), false)
    assert.equal(layoutBottomExceedsPageContentEnd(55 * LINE, end, start), true)
  })
})

describe('wholeLinesInSpan', () => {
  it('counts whole lines in an exact span', () => {
    assert.equal(wholeLinesInSpan(0), 0)
    assert.equal(wholeLinesInSpan(LINE), 1)
    assert.equal(wholeLinesInSpan(10 * LINE), 10)
  })

  it('does not drop a line when a grid-aligned span measures a hair short', () => {
    assert.equal(wholeLinesInSpan(LINE - OBSERVED_NOISE_PX), 1)
    assert.equal(wholeLinesInSpan(10 * LINE - OBSERVED_SCALE_INFERENCE_BIAS_PX), 10)
  })

  it('does not invent a line from a span that is genuinely short', () => {
    assert.equal(wholeLinesInSpan(LINE - 1), 0)
    assert.equal(wholeLinesInSpan(LINE / 2), 0)
  })
})

describe('layoutBottomForPaginationOverflow', () => {
  it('drops the trailing blank-line spacer for types that carry one', () => {
    for (const t of ['action', 'dialogue', 'slugline', 'transition']) {
      assert.equal(layoutBottomForPaginationOverflow(t, 800), 800 - LINE)
    }
  })

  it('leaves types without a spacer alone', () => {
    for (const t of ['character', 'parenthetical', 'title', 'author', 'contact']) {
      assert.equal(layoutBottomForPaginationOverflow(t, 800), 800)
    }
  })

  it('defaults an undefined type to action', () => {
    assert.equal(layoutBottomForPaginationOverflow(undefined, 800), 800 - LINE)
  })
})

describe('transformScaleY', () => {
  it('returns null for no transform', () => {
    assert.equal(transformScaleY('none'), null)
    assert.equal(transformScaleY(''), null)
  })

  it('reads the vertical scale out of a 2d matrix', () => {
    assert.equal(transformScaleY('matrix(0.8689, 0, 0, 0.8689, 0, 0)'), 0.8689)
  })

  it('reads m22 out of a 3d matrix', () => {
    assert.equal(
      transformScaleY('matrix3d(0.75, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'),
      0.75,
    )
  })

  it('returns null for a value it cannot read rather than guessing 1', () => {
    assert.equal(transformScaleY('perspective(500px)'), null)
  })

  it('the display scale round-trips through a matrix string', () => {
    const z = 709 / 816
    assert.equal(transformScaleY(`matrix(${z}, 0, 0, ${z}, 0, 0)`), z)
  })
})

describe('page geometry constants stay in sync', () => {
  it('content band is the paper height minus both margins', () => {
    assert.equal(
      SCREENPLAY_CONTENT_HEIGHT_PX,
      SCREENPLAY_PAPER_HEIGHT_PX - SCREENPLAY_MARGIN_TOP_PX - SCREENPLAY_MARGIN_BOTTOM_PX,
    )
  })
})
