import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  classifyElementTypeRelative,
  DEFAULT_BASE_X_PT,
  expandDualDialoguePageRows,
  findBaseX,
  isContdArtifact,
  isMoreArtifact,
  isPageNumberArtifact,
  isSceneHeading,
  mergeScriptBlockText,
  RELATIVE_BAND_OFFSET_PT,
  shouldMergeElementTypes,
  shouldSkipContdCharacterCue,
  shouldSkipPaginationLine,
  stripPaginationMarkerText,
  type ParseLineGroup,
} from './parseScreenplayPdfUtils'

const LETTER_HEIGHT_PT = 792
const BASE_X = DEFAULT_BASE_X_PT

function line(overrides: Partial<ParseLineGroup>): ParseLineGroup {
  return {
    x: BASE_X,
    right: BASE_X + 100,
    y: 400,
    text: '',
    pageNum: 1,
    ...overrides,
  }
}

describe('parseScreenplayPdfUtils', () => {
  it('matches EXT./INT. sluglines', () => {
    assert.equal(isSceneHeading('EXT./INT. CAYCE CABIN - DAY'), true)
    assert.equal(isSceneHeading('EXT.  /  INT.  CAYCE CABIN - DAY'), true)
  })

  it('strips pagination markers from text', () => {
    assert.equal(stripPaginationMarkerText("JOHN (CONT'D)"), 'JOHN')
    assert.equal(stripPaginationMarkerText('hello (MORE) world'), 'hello world')
  })

  it('skips (MORE) lines and sets afterMore flag', () => {
    const r = shouldSkipPaginationLine('(MORE)', { afterMore: false })
    assert.equal(r.skip, true)
    assert.equal(r.next.afterMore, true)
  })

  it('findBaseX returns the most frequent action-column x by paragraph', () => {
    const lines: ParseLineGroup[] = [
      line({ x: 108, y: 700, text: 'One.' }),
      line({ x: 109, y: 660, text: 'Two.' }),
      line({ x: 108, y: 620, text: 'Three.' }),
      line({ x: 180, y: 580, text: 'Dialogue.' }),
    ]
    assert.equal(findBaseX(lines), 108)
  })

  it('findBaseX falls back to 108 when no lines match', () => {
    assert.equal(findBaseX([]), 108)
    assert.equal(findBaseX([line({ x: 20, text: 'edge' })]), 108)
  })

  it('findBaseX counts each paragraph once instead of every wrapped line', () => {
    // Regression test: a dialogue-heavy script can have far more *wrapped lines* of dialogue than
    // action, even when action still has more *paragraphs*. Raw per-line frequency wrongly
    // calibrates baseX to the dialogue column in that case; paragraph-start weighting should not.
    const lines: ParseLineGroup[] = []
    let y = 700

    // 4 action paragraphs at x=108, 2 wrapped lines each: 8 raw lines, 4 paragraph starts.
    for (let p = 0; p < 4; p++) {
      lines.push(line({ x: 108, y, text: `Action para ${p} line 1.` }))
      y -= 12 // small gap: still the same paragraph
      lines.push(line({ x: 108, y, text: `Action para ${p} line 2.` }))
      y -= 30 // large gap: next paragraph
    }

    // 3 dialogue speeches at x=180, 5 wrapped lines each: 15 raw lines, only 3 paragraph starts.
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < 5; i++) {
        lines.push(line({ x: 180, y, text: `Dialogue speech ${s} line ${i}.` }))
        y -= 12
      }
      y -= 30
    }

    // Raw per-line frequency would wrongly favor dialogue (15 lines vs 8). Paragraph-start
    // weighting correctly favors action (4 paragraph starts vs 3).
    assert.equal(findBaseX(lines), 108)
  })

  it('classifies by nearest relative X band from baseX', () => {
    assert.equal(
      classifyElementTypeRelative(BASE_X, 'He walks in.', BASE_X),
      'action',
    )
    assert.equal(
      classifyElementTypeRelative(BASE_X, 'INT. HOUSE - DAY', BASE_X),
      'slugline',
    )
    assert.equal(
      classifyElementTypeRelative(BASE_X + RELATIVE_BAND_OFFSET_PT.dialogue, 'Hello.', BASE_X),
      'dialogue',
    )
    assert.equal(
      classifyElementTypeRelative(
        BASE_X + RELATIVE_BAND_OFFSET_PT.parenthetical,
        '(quietly)',
        BASE_X,
      ),
      'parenthetical',
    )
    assert.equal(
      classifyElementTypeRelative(BASE_X + RELATIVE_BAND_OFFSET_PT.character, 'JOHN', BASE_X),
      'character',
    )
    assert.equal(
      classifyElementTypeRelative(BASE_X + RELATIVE_BAND_OFFSET_PT.transition + 10, 'CUT TO:', BASE_X),
      'transition',
    )
  })

  it('classifies parens-wrapped text as parenthetical even when the x-band says dialogue/action', () => {
    // Simulates a source PDF whose parenthetical column sits closer to the dialogue band than our
    // default offset assumes — the text pattern should still win over the x-band nearest-match.
    assert.equal(
      classifyElementTypeRelative(BASE_X + RELATIVE_BAND_OFFSET_PT.dialogue, '(annoyed)', BASE_X),
      'parenthetical',
    )
    assert.equal(
      classifyElementTypeRelative(BASE_X + RELATIVE_BAND_OFFSET_PT.dialogue, '(sitting up)', BASE_X),
      'parenthetical',
    )
    assert.equal(
      classifyElementTypeRelative(BASE_X, '(beat)', BASE_X),
      'parenthetical',
    )
    // Real dialogue at the same x-band is unaffected.
    assert.equal(
      classifyElementTypeRelative(BASE_X + RELATIVE_BAND_OFFSET_PT.dialogue, 'Fuck.', BASE_X),
      'dialogue',
    )
    // A line that merely contains parens without wrapping the whole line is not overridden.
    assert.equal(
      classifyElementTypeRelative(BASE_X + RELATIVE_BAND_OFFSET_PT.dialogue, 'Really? (are you sure)', BASE_X),
      'dialogue',
    )
  })

  it('classifies custom-margin PDFs relative to calibrated baseX', () => {
    const customBase = 90
    assert.equal(
      classifyElementTypeRelative(customBase, 'Action line.', customBase),
      'action',
    )
    assert.equal(
      classifyElementTypeRelative(customBase + RELATIVE_BAND_OFFSET_PT.dialogue, 'Hello.', customBase),
      'dialogue',
    )
    assert.equal(
      classifyElementTypeRelative(customBase + RELATIVE_BAND_OFFSET_PT.character, 'MARY', customBase),
      'character',
    )
  })

  it('merges de-wrapped text with spaces and hyphen exception', () => {
    assert.equal(mergeScriptBlockText('First line.', 'Second line.'), 'First line. Second line.')
    assert.equal(mergeScriptBlockText('not-', 'guilty'), 'not-guilty')
  })

  it('shouldMergeElementTypes allows action/dialogue/parenthetical only', () => {
    assert.equal(shouldMergeElementTypes('action', 'action'), true)
    assert.equal(shouldMergeElementTypes('dialogue', 'dialogue'), true)
    assert.equal(shouldMergeElementTypes('character', 'character'), false)
    assert.equal(shouldMergeElementTypes('slugline', 'slugline'), false)
  })

  it('skips CONTD character cue mid-dialogue stream', () => {
    assert.equal(
      shouldSkipContdCharacterCue('character', "JOHN (CONT'D)", 'dialogue'),
      true,
    )
    assert.equal(
      shouldSkipContdCharacterCue('character', "JOHN (CONT'D)", 'parenthetical'),
      true,
    )
    assert.equal(
      shouldSkipContdCharacterCue('character', "JOHN (CONT'D)", 'action'),
      false,
    )
    assert.equal(shouldSkipContdCharacterCue('character', 'JOHN', 'dialogue'), false)
  })

  it('detects page-number artifacts in top 2 inches, right half (x > 300)', () => {
    const artifact = line({
      x: 400,
      y: LETTER_HEIGHT_PT - 50,
      text: '2.',
    })
    assert.equal(isPageNumberArtifact(artifact, LETTER_HEIGHT_PT), true)

    const bodyLine = line({
      x: BASE_X,
      y: 400,
      text: '2.',
    })
    assert.equal(isPageNumberArtifact(bodyLine, LETTER_HEIGHT_PT), false)

    const leftTop = line({
      x: 250,
      y: LETTER_HEIGHT_PT - 50,
      text: '3.',
    })
    assert.equal(isPageNumberArtifact(leftTop, LETTER_HEIGHT_PT), false)
  })

  it('detects (MORE) artifacts in bottom margin (low Y)', () => {
    const artifact = line({ y: 60, text: '(MORE)' })
    assert.equal(isMoreArtifact(artifact, LETTER_HEIGHT_PT, false), true)

    const bodyLine = line({ y: 300, text: '(MORE)' })
    assert.equal(isMoreArtifact(bodyLine, LETTER_HEIGHT_PT, false), false)
  })

  it('detects (MORE) as an artifact when it is the last line on the page, even outside the tight Y band', () => {
    // Real-world case: bottom-margin geometry varies enough across PDF exporters that a genuine
    // "(MORE)" can sit just outside the Y band. Being the page's final line is strong evidence on
    // its own, so it should still be recognized as an artifact.
    const lastLineOutsideBand = line({ y: 100, text: '(MORE)' })
    assert.equal(isMoreArtifact(lastLineOutsideBand, LETTER_HEIGHT_PT, true), true)

    // The same line and Y, *not* confirmed as the page's last line, is left alone — keeping the Y
    // band itself conservative (no risk of stripping a short, valid line near the bottom margin).
    assert.equal(isMoreArtifact(lastLineOutsideBand, LETTER_HEIGHT_PT, false), false)
  })

  it('detects standalone CONTD at page top', () => {
    const artifact = line({
      y: LETTER_HEIGHT_PT - 80,
      text: "(CONT'D)",
    })
    assert.equal(isContdArtifact(artifact, LETTER_HEIGHT_PT), true)

    const inline = line({
      y: LETTER_HEIGHT_PT - 80,
      text: "JOHN (CONT'D)",
    })
    assert.equal(isContdArtifact(inline, LETTER_HEIGHT_PT), false)
  })

  it('expands dual-column rows column-first per segment', () => {
    const rows: Array<[number, Array<{ x: number; str: string; w: number }>]> = [
      [100, [{ x: 72, str: 'Action.', w: 40 }]],
      [
        90,
        [
          { x: 240, str: 'DESTINEE', w: 50 },
          { x: 380, str: 'HAROLD', w: 40 },
        ],
      ],
      [80, [{ x: 180, str: 'Left line.', w: 60 }, { x: 360, str: 'Right line.', w: 60 }]],
      [70, [{ x: 72, str: 'More action.', w: 50 }]],
    ]
    const lines = expandDualDialoguePageRows(rows, 1, BASE_X)
    assert.equal(lines[0].text, 'Action.')
    assert.equal(lines[1].text, 'DESTINEE')
    assert.equal(lines[2].text, 'Left line.')
    assert.equal(lines[3].text, 'HAROLD')
    assert.equal(lines[4].text, 'Right line.')
    assert.equal(lines[5].text, 'More action.')
  })

  it('does not split an isolated dual-looking row without a confirming neighbor', () => {
    // "HAROLD (CONT'D)" on its own row has a 49pt gap between the name and its suffix — over the
    // 40pt cluster threshold — but neither adjacent row is dual-column, so it must stay merged
    // rather than being torn into a spurious "character" fragment.
    const rows: Array<[number, Array<{ x: number; str: string; w: number }>]> = [
      [200, [{ x: 108, str: 'Some action before.', w: 80 }]],
      [
        180,
        [
          { x: 252, str: 'HAROLD', w: 40 },
          { x: 301, str: "(CONT'D)", w: 45 },
        ],
      ],
      [160, [{ x: 108, str: 'Some action after.', w: 80 }]],
    ]
    const lines = expandDualDialoguePageRows(rows, 1, BASE_X)
    assert.equal(lines.length, 3)
    assert.equal(lines[1].text, "HAROLD (CONT'D)")
  })

  it('confirms a lone dual-column row once an adjacent row shares the pattern', () => {
    // Same shape as above, but this time immediately followed by a real second dual-column row —
    // the persistence requirement should now confirm the split instead of suppressing it.
    const rows: Array<[number, Array<{ x: number; str: string; w: number }>]> = [
      [200, [{ x: 108, str: 'Some action before.', w: 80 }]],
      [
        180,
        [
          { x: 252, str: 'HAROLD', w: 40 },
          { x: 301, str: "(CONT'D)", w: 45 },
        ],
      ],
      [
        160,
        [
          { x: 252, str: 'DESTINEE', w: 50 },
          { x: 400, str: 'CLAIRE', w: 40 },
        ],
      ],
    ]
    const lines = expandDualDialoguePageRows(rows, 1, BASE_X)
    // Column-first: the single-column line, then both rows' left-column text, then both rows'
    // right-column text.
    assert.deepEqual(
      lines.map((l) => l.text),
      ['Some action before.', 'HAROLD', 'DESTINEE', "(CONT'D)", 'CLAIRE'],
    )
  })

  it('splits dual dialogue relative to a custom calibrated baseX, not the fixed default', () => {
    const customBase = 90 // narrower left margin than the WGA-standard default (108)
    const rows: Array<[number, Array<{ x: number; str: string; w: number }>]> = [
      [200, [{ x: customBase, str: 'Action line.', w: 60 }]],
      [
        180,
        [
          { x: customBase + RELATIVE_BAND_OFFSET_PT.character, str: 'DESTINEE', w: 50 },
          { x: customBase + RELATIVE_BAND_OFFSET_PT.character + 160, str: 'HAROLD', w: 40 },
        ],
      ],
      [
        160,
        [
          { x: customBase + RELATIVE_BAND_OFFSET_PT.dialogue, str: 'Left.', w: 30 },
          { x: customBase + RELATIVE_BAND_OFFSET_PT.dialogue + 160, str: 'Right.', w: 30 },
        ],
      ],
      [140, [{ x: customBase, str: 'More action.', w: 60 }]],
    ]
    const lines = expandDualDialoguePageRows(rows, 1, customBase)
    assert.deepEqual(
      lines.map((l) => l.text),
      ['Action line.', 'DESTINEE', 'Left.', 'HAROLD', 'Right.', 'More action.'],
    )
  })
})
