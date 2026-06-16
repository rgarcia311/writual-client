import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  expandDualDialoguePageRows,
  isSceneHeading,
  shouldSkipPaginationLine,
  stripPaginationMarkerText,
} from './parseScreenplayPdfUtils'

describe('parseScreenplayPdfUtils', () => {
  it('matches EXT./INT. sluglines', () => {
    assert.equal(isSceneHeading('EXT./INT. CAYCE CABIN - DAY'), true)
    assert.equal(isSceneHeading('EXT.  /  INT.  CAYCE CABIN - DAY'), true)
  })

  it('strips pagination markers from text', () => {
    assert.equal(stripPaginationMarkerText('JOHN (CONT\'D)'), 'JOHN')
    assert.equal(stripPaginationMarkerText('hello (MORE) world'), 'hello world')
  })

  it('skips (MORE) lines and sets afterMore flag', () => {
    const r = shouldSkipPaginationLine('(MORE)', { afterMore: false })
    assert.equal(r.skip, true)
    assert.equal(r.next.afterMore, true)
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
    const lines = expandDualDialoguePageRows(rows, 1)
    assert.equal(lines[0].text, 'Action.')
    assert.equal(lines[1].text, 'DESTINEE')
    assert.equal(lines[2].text, 'Left line.')
    assert.equal(lines[3].text, 'HAROLD')
    assert.equal(lines[4].text, 'Right line.')
    assert.equal(lines[5].text, 'More action.')
  })
})
