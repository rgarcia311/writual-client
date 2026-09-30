import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SCREENPLAY_PAGE_PITCH_PX,
  SCREENPLAY_READING_WINDOW_RADIUS,
  bodyPageFromSheet,
  columnBoundsForPageWindow,
  columnYFromPageAnchor,
  pageAnchorFromColumnY,
  screenplayPageWindow,
} from './screenplayPageGeometry'
import {
  SCREENPLAY_INTER_PAGE_GAP_PX,
  SCREENPLAY_MARGIN_TOP_PX,
  SCREENPLAY_PAPER_HEIGHT_PX,
} from './screenplayPaperLayout'

/**
 * The reading position is stored as a sheet number rather than a pixel offset, so these are the
 * conversions that decide which page a returning reader lands on. Everything is derived from the
 * two layout facts the paper stack is built from: sheets are one pitch apart, and the ProseMirror
 * column starts one top margin below sheet 1.
 */

/** Layout-space y, measured from the ProseMirror column's top, of sheet `n`'s top edge. */
function columnYOfSheetTop(n: number): number {
  return (n - 1) * SCREENPLAY_PAGE_PITCH_PX - SCREENPLAY_MARGIN_TOP_PX
}

describe('SCREENPLAY_PAGE_PITCH_PX', () => {
  it('is the paper plus one inter-page gap', () => {
    assert.equal(
      SCREENPLAY_PAGE_PITCH_PX,
      SCREENPLAY_PAPER_HEIGHT_PX + SCREENPLAY_INTER_PAGE_GAP_PX,
    )
  })
})

describe('pageAnchorFromColumnY', () => {
  it('puts the top of the column on sheet 1, one margin in', () => {
    const anchor = pageAnchorFromColumnY(0, 10)
    assert.equal(anchor.sheet, 1)
    assert.ok(Math.abs(anchor.ratio - SCREENPLAY_MARGIN_TOP_PX / SCREENPLAY_PAGE_PITCH_PX) < 1e-9)
  })

  it('reports each sheet top as that sheet at ratio 0', () => {
    for (const sheet of [1, 2, 7, 50]) {
      const anchor = pageAnchorFromColumnY(columnYOfSheetTop(sheet), 120)
      assert.equal(anchor.sheet, sheet)
      assert.equal(anchor.ratio, 0)
    }
  })

  it('stays on a sheet one pixel before the next one starts', () => {
    const anchor = pageAnchorFromColumnY(columnYOfSheetTop(9) - 1, 120)
    assert.equal(anchor.sheet, 8)
    assert.ok(anchor.ratio > 0.99)
  })

  it('clamps past the end of the document to the last sheet', () => {
    const anchor = pageAnchorFromColumnY(columnYOfSheetTop(400), 12)
    assert.equal(anchor.sheet, 12)
    assert.equal(anchor.ratio, 1)
  })

  it('clamps a negative offset (over-scroll bounce) to the first sheet', () => {
    assert.deepEqual(pageAnchorFromColumnY(-5000, 12), { sheet: 1, ratio: 0 })
  })

  it('does not clamp when pagination has not reported a total yet', () => {
    assert.equal(pageAnchorFromColumnY(columnYOfSheetTop(30), 0).sheet, 30)
  })
})

describe('columnYFromPageAnchor', () => {
  it('round-trips every sheet top', () => {
    for (const sheet of [1, 2, 33, 118]) {
      const y = columnYOfSheetTop(sheet)
      assert.ok(Math.abs(columnYFromPageAnchor(pageAnchorFromColumnY(y, 120), 120) - y) < 1e-9)
    }
  })

  it('round-trips a mid-sheet position', () => {
    const y = columnYOfSheetTop(42) + 500
    assert.ok(Math.abs(columnYFromPageAnchor(pageAnchorFromColumnY(y, 120), 120) - y) < 1e-9)
  })

  it('lands on the same sheet when the document has repaginated longer', () => {
    // The offset the reader was at is meaningless after an edit shifts everything; the sheet is not.
    const y = columnYFromPageAnchor({ sheet: 40, ratio: 0 }, 500)
    assert.equal(pageAnchorFromColumnY(y, 500).sheet, 40)
  })

  it('clamps a stored sheet the document has since shrunk past onto the last one', () => {
    const y = columnYFromPageAnchor({ sheet: 90, ratio: 0.5 }, 12)
    assert.equal(y, columnYOfSheetTop(12) + 0.5 * SCREENPLAY_PAGE_PITCH_PX)
    assert.equal(pageAnchorFromColumnY(y, 12).sheet, 12)
  })
})

describe('screenplayPageWindow', () => {
  it('spans five sheets either side by default', () => {
    assert.equal(SCREENPLAY_READING_WINDOW_RADIUS, 5)
    assert.deepEqual(screenplayPageWindow(40, 120), { start: 35, end: 45 })
  })

  it('clips at the start of the document rather than going below sheet 1', () => {
    assert.deepEqual(screenplayPageWindow(3, 120), { start: 1, end: 8 })
  })

  it('clips at the end of the document', () => {
    assert.deepEqual(screenplayPageWindow(118, 120), { start: 113, end: 120 })
  })

  it('collapses to the single sheet of a one-page document', () => {
    assert.deepEqual(screenplayPageWindow(1, 1), { start: 1, end: 1 })
  })
})

describe('columnBoundsForPageWindow', () => {
  it('brackets exactly the window it is given', () => {
    const bounds = columnBoundsForPageWindow({ start: 35, end: 45 })
    assert.equal(bounds.top, columnYOfSheetTop(35))
    assert.equal(bounds.bottom, columnYOfSheetTop(46))
    assert.equal(bounds.bottom - bounds.top, 11 * SCREENPLAY_PAGE_PITCH_PX)
  })
})

describe('bodyPageFromSheet', () => {
  it('drops the cover sheet from the count a writer would quote', () => {
    assert.equal(bodyPageFromSheet(1, true), 0)
    assert.equal(bodyPageFromSheet(2, true), 1)
    assert.equal(bodyPageFromSheet(113, true), 112)
  })

  it('counts every sheet when the script has no cover page', () => {
    assert.equal(bodyPageFromSheet(1, false), 1)
    assert.equal(bodyPageFromSheet(112, false), 112)
  })
})
