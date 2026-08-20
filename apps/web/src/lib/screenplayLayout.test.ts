import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  clampLayoutConfig,
  inferLayoutFromPdfMeasurements,
  type ScreenplayPdfMeasurements,
} from './screenplayLayout'

/** Width one rendered character occupies in the editor (12pt Courier @ 10 CPI, 96dpi). */
const CHAR_WIDTH_PX = 9.6

/** Characters that actually fit in a column of `widthPx`, the way the browser wraps it. */
const charsThatFit = (widthPx: number) => Math.floor(widthPx / CHAR_WIDTH_PX)

/**
 * Real geometry from a Final Draft export (DELPHI, CA) whose longest dialogue line is 35 characters.
 * The column is typeset on the 7.2pt/char (10 CPI) grid — 180pt → 432pt — but pdf.js reports the
 * drawn glyph advances as only 6.977pt/char, so the measured ink extent stops at 424.19pt.
 */
const DELPHI: ScreenplayPdfMeasurements = {
  pageWidthPt: 612,
  pageHeightPt: 792,
  baseXPt: 108,
  actionRightMaxPt: 533.41,
  actionLineCount: 120,
  dialogueLeftPt: 180,
  parentheticalLeftPt: null,
  characterLeftPt: 252,
  dialogueRightMaxPt: 424.19,
  parentheticalRightMaxPt: null,
}

describe('inferLayoutFromPdfMeasurements', () => {
  it('sizes the dialogue column from the character count, not the ink extent', () => {
    const cfg = inferLayoutFromPdfMeasurements({ ...DELPHI, dialogueMaxChars: 35 })
    assert.ok(cfg)
    // The source's longest printed line must fit, or every full-width line re-wraps and the
    // document paginates a page long.
    assert.equal(charsThatFit(cfg.dialogueTextWidthPx!), 35)
    // …and no wider: a 36th character would drift pagination the other way.
    assert.ok(cfg.dialogueTextWidthPx! < 36 * CHAR_WIDTH_PX)
  })

  it('would under-size that same column from the ink extent alone', () => {
    const cfg = inferLayoutFromPdfMeasurements(DELPHI)
    assert.ok(cfg)
    assert.equal(charsThatFit(cfg.dialogueTextWidthPx!), 34)
  })

  it('keeps the ink extent as a floor when it is the wider measurement', () => {
    // A source whose glyphs run wider than 10 CPI: 30 chars measured out to 300pt (= 400px).
    const cfg = inferLayoutFromPdfMeasurements({
      ...DELPHI,
      dialogueRightMaxPt: 480,
      dialogueMaxChars: 30,
    })
    assert.ok(cfg)
    assert.ok(cfg.dialogueTextWidthPx! > 30 * CHAR_WIDTH_PX)
    assert.equal(cfg.dialogueTextWidthPx, 405) // ptToPx(480 − 180) + 4.8 safety
  })

  it('omits the dialogue width when neither measurement is available', () => {
    const cfg = inferLayoutFromPdfMeasurements({
      ...DELPHI,
      dialogueRightMaxPt: null,
      dialogueMaxChars: 0,
    })
    assert.ok(cfg)
    assert.equal(cfg.dialogueTextWidthPx, undefined)
  })

  it('measures indents from the document own left margin', () => {
    const cfg = inferLayoutFromPdfMeasurements({ ...DELPHI, dialogueMaxChars: 35 })
    assert.ok(cfg)
    assert.equal(cfg.dialogueIndentPx, 96) // (180 − 108)pt = 1.0"
    assert.equal(cfg.characterIndentPx, 192) // (252 − 108)pt = 2.0"
  })

  it('survives the clamp it is stored and re-read through', () => {
    const cfg = inferLayoutFromPdfMeasurements({ ...DELPHI, dialogueMaxChars: 35 })
    const round = clampLayoutConfig(cfg)
    assert.ok(round)
    assert.equal(round.dialogueTextWidthPx, cfg!.dialogueTextWidthPx)
  })
})
