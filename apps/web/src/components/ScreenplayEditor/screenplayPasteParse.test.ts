import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parsePastedScreenplayLines,
  parsePastedScreenplayText,
} from './screenplayPasteParse'

const types = (raw: string) => parsePastedScreenplayText(raw).map((b) => b.elementType)
const texts = (raw: string) => parsePastedScreenplayText(raw).map((b) => b.text)

describe('parsePastedScreenplayText — indented source (PDF / plain-text export)', () => {
  const indented = [
    'INT. COFFEE SHOP - DAY',
    '',
    'Maya slides into the booth, coat still on.',
    '',
    '                      MAYA',
    '                (breathless)',
    '          You will not believe what just happened.',
    '',
    '                      SAM',
    '          Try me.',
    '',
    '                                        CUT TO:',
  ].join('\n')

  it('assigns each element its own type from the column it sits in', () => {
    assert.deepEqual(types(indented), [
      'slugline',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'character',
      'dialogue',
      'transition',
    ])
  })

  it('keeps the element text without its indentation', () => {
    assert.deepEqual(texts(indented).slice(0, 5), [
      'INT. COFFEE SHOP - DAY',
      'Maya slides into the booth, coat still on.',
      'MAYA',
      '(breathless)',
      'You will not believe what just happened.',
    ])
  })

  it('re-joins lines the source hard-wrapped, and heals a split word', () => {
    const wrapped = [
      'The hallway stretches out ahead of them, lit only by the emergency strip along the',
      'floor, humming faintly.',
      '',
      '                      MAYA',
      '          We should not be down here, and you know it as well as anyone else on',
      '          this crew does.',
    ].join('\n')
    const blocks = parsePastedScreenplayText(wrapped)
    assert.deepEqual(
      blocks.map((b) => b.elementType),
      ['action', 'character', 'dialogue'],
    )
    assert.equal(
      blocks[0].text,
      'The hallway stretches out ahead of them, lit only by the emergency strip along the floor, humming faintly.',
    )
    assert.equal(
      blocks[2].text,
      'We should not be down here, and you know it as well as anyone else on this crew does.',
    )
  })

  it('drops page furniture the source printed between pages', () => {
    const withArtifacts = [
      '                      MAYA',
      '          Wait for it.',
      '                    (MORE)',
      '',
      '     12.',
      '',
      '                      MAYA (CONT\'D)',
      '          There it is.',
    ].join('\n')
    assert.deepEqual(types(withArtifacts), [
      'character',
      'dialogue',
      'character',
      'dialogue',
    ])
  })
})

describe('parsePastedScreenplayText — flattened source (HTML copy with no indentation)', () => {
  const flat = [
    'INT. COFFEE SHOP - DAY',
    '',
    'Maya slides into the booth, coat still on.',
    '',
    'MAYA',
    '(breathless)',
    'You will not believe what just happened.',
    '',
    'SAM',
    'Try me.',
    '',
    'CUT TO:',
  ].join('\n')

  it('recovers element types from the text alone', () => {
    assert.deepEqual(types(flat), [
      'slugline',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'character',
      'dialogue',
      'transition',
    ])
  })

  it('does not read an all-caps line with nothing under it as a character cue', () => {
    assert.deepEqual(types('The door slams.\n\nBOOM.\n'), ['action', 'action'])
  })

  it('leaves ordinary prose as action', () => {
    assert.deepEqual(types('She waited all day.\n\nThen she left.'), ['action', 'action'])
  })
})

describe('parsePastedScreenplayLines — source-stated element hints', () => {
  it('trusts an element type the source named outright', () => {
    const blocks = parsePastedScreenplayLines([
      { text: 'MAYA', indentChars: 0, hint: 'character' },
      { text: 'Say that again.', indentChars: 0, hint: 'dialogue' },
      { text: 'She does not.', indentChars: 0, hint: 'action' },
    ])
    assert.deepEqual(
      blocks.map((b) => b.elementType),
      ['character', 'dialogue', 'action'],
    )
  })
})
