import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  BASELINE_OFFSET_IN,
  buildPdfLayout,
  FIRST_BASELINE_IN,
  LINES_PER_PAGE,
  PAGE_NUM_BASELINE_IN,
  TEXT_LEFT_IN,
  TEXT_RIGHT_IN,
  TEXT_WIDTH_IN,
  TOP_CONTENT_IN,
} from './screenplayPdfLayout'
import { SCREENPLAY_LINE_HEIGHT_INCHES } from './screenplaySpacing'

/** Reference screenplay exports measured in PDF points, converted to inches. */
const pt = (points: number) => points / 72
/** Courier at 10 CPI: one character is exactly 1/10". */
const charsThatFit = (widthIn: number) => Math.floor(widthIn / 0.1 + 1e-9)

const close = (actual: number, expected: number, msg: string) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${msg}: expected ${expected}, got ${actual}`,
  )

describe('screenplay PDF page geometry', () => {
  it('places the first baseline one ascent below the 1" top margin', () => {
    // jsPDF's doc.text() positions the BASELINE at y. Writing the first line at the raw margin
    // floated every page 8pt high; reference exports put their first baseline at 1.111".
    close(FIRST_BASELINE_IN, TOP_CONTENT_IN + BASELINE_OFFSET_IN, 'first baseline')
    close(FIRST_BASELINE_IN, pt(80), 'first baseline vs reference export (792 - 712 pt)')
  })

  it('places the page number on the same grid, 0.5" below the paper top', () => {
    close(PAGE_NUM_BASELINE_IN, pt(44), 'page number baseline vs reference (792 - 748 pt)')
  })

  it('fits exactly 54 lines between the 1" top and bottom margins', () => {
    const lastBaseline = FIRST_BASELINE_IN + (LINES_PER_PAGE - 1) * SCREENPLAY_LINE_HEIGHT_INCHES
    close(lastBaseline, pt(792 - 76), 'last baseline vs reference export')
    assert.ok(lastBaseline <= 11 - TOP_CONTENT_IN, 'last line must clear the bottom margin')
    const overflow = FIRST_BASELINE_IN + LINES_PER_PAGE * SCREENPLAY_LINE_HEIGHT_INCHES
    assert.ok(overflow > 11 - TOP_CONTENT_IN, 'a 55th line must not fit')
  })
})

describe('buildPdfLayout', () => {
  it('falls back to the WGA defaults when no layout was inferred', () => {
    const l = buildPdfLayout(null)
    close(l.action.x, 1.5, 'action x')
    close(l.action.w, 6.0, 'action width')
    close(l.dialogue.x, 2.5, 'dialogue x')
    close(l.character.x, TEXT_LEFT_IN + 211 / 96, 'character x (default 211px indent)')
    close(l.transition.rightEdge ?? 0, TEXT_RIGHT_IN, 'transition right edge')
  })

  it('applies a measured per-document config, so the PDF matches the editor', () => {
    // What inferLayoutFromPdfMeasurements produces for a source typeset with a 3.5" cue indent.
    const l = buildPdfLayout({ characterIndentPx: 192, dialogueIndentPx: 96, measured: true })
    close(l.character.x, 3.5, 'character x follows the inferred indent')
    close(l.dialogue.x, 2.5, 'dialogue x')
  })

  it('keeps the action measure at the fixed WGA 6.0", never a source-measured width', () => {
    // screenplayLayout.ts deliberately exposes no action-width field: the right margin is always
    // 1.0" regardless of how the source PDF was typeset. Guard against that silently changing.
    const l = buildPdfLayout({ characterIndentPx: 100, dialogueTextWidthPx: 500, measured: true })
    close(l.action.w, TEXT_WIDTH_IN, 'action width stays at the text-area width')
    close(l.action.x + l.action.w, TEXT_RIGHT_IN, 'action right edge stays at 7.5"')
  })

  it('yields the character counts a 12pt Courier column must hold', () => {
    const l = buildPdfLayout({ characterIndentPx: 192, dialogueTextWidthPx: 341, measured: true })
    assert.equal(charsThatFit(l.action.w), 60, 'action column holds 60 characters')
    assert.equal(charsThatFit(l.dialogue.w), 35, 'dialogue column holds 35 characters')
  })

  it('hangs the title-page contact block 0.5" into the left margin', () => {
    // Reference exports place it at x = 72pt = 1.0" from the paper edge, not at the 1.5" text
    // column, and give it room out to the same 7.5" right margin as the body.
    const l = buildPdfLayout(null)
    close(l.contact.x, 1.0, 'contact x')
    close(l.contact.x + l.contact.w, TEXT_RIGHT_IN, 'contact right edge')
    assert.ok(l.contact.x < TEXT_LEFT_IN, 'contact hangs outside the text area')
  })

  it('reports no inferred config when there is no page to read (headless callers)', async () => {
    const { readLayoutConfigFromPage } = await import('./screenplayPdfLayout')
    assert.equal(readLayoutConfigFromPage(), null)
  })
})
