import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isSceneHeadingText } from './screenplayElementDetection'

describe('isSceneHeadingText', () => {
  it('matches standard INT./EXT. prefixes', () => {
    assert.equal(isSceneHeadingText('INT. COFFEE SHOP - DAY'), true)
    assert.equal(isSceneHeadingText('EXT. PARKING LOT - NIGHT'), true)
    assert.equal(isSceneHeadingText('int. house - morning'), true)
  })

  it('matches intercut / reversed prefixes', () => {
    assert.equal(isSceneHeadingText('INT./EXT. CAR - CONTINUOUS'), true)
    assert.equal(isSceneHeadingText('EXT/INT. DOORWAY - DUSK'), true)
    assert.equal(isSceneHeadingText('I/E. KITCHEN - DAY'), true)
  })

  it('matches a bare dash + time-of-day suffix with no INT/EXT prefix', () => {
    assert.equal(isSceneHeadingText('Later - NIGHT'), true)
    assert.equal(isSceneHeadingText('THE OFFICE - DAY'), true)
    assert.equal(isSceneHeadingText('LOBBY - EVENING'), true)
    assert.equal(isSceneHeadingText('ROOFTOP - DUSK'), true)
    assert.equal(isSceneHeadingText('HALLWAY - DAWN'), true)
    assert.equal(isSceneHeadingText('KITCHEN - CONTINUOUS'), true)
    assert.equal(isSceneHeadingText('STREET - MOMENTS LATER'), true)
    assert.equal(isSceneHeadingText('BEDROOM - SAME TIME'), true)
  })

  it('tolerates en/em dashes and varied spacing', () => {
    assert.equal(isSceneHeadingText('PARK – NIGHT'), true)
    assert.equal(isSceneHeadingText('PARK — NIGHT'), true)
    assert.equal(isSceneHeadingText('PARK -NIGHT'), true)
  })

  it('does not match ordinary action text', () => {
    assert.equal(isSceneHeadingText('She waited all day, then left.'), false)
    assert.equal(isSceneHeadingText('He stared at the door.'), false)
    assert.equal(isSceneHeadingText(''), false)
    assert.equal(isSceneHeadingText('   '), false)
    assert.equal(isSceneHeadingText('This is interesting.'), false)
  })

  it('does not false-positive on a dash unrelated to time of day', () => {
    assert.equal(isSceneHeadingText('He said - and I quote - nothing.'), false)
    assert.equal(isSceneHeadingText('Well-known actor enters.'), false)
  })

  it('matches immediately as a prefix is typed, without waiting for more text', () => {
    // Regression: text.trim() used to strip the trailing space that "\s+" required,
    // so "int. " (the exact moment a user finishes typing the prefix) failed to match.
    assert.equal(isSceneHeadingText('int. '), true)
    assert.equal(isSceneHeadingText('INT. '), true)
    assert.equal(isSceneHeadingText('EXT. '), true)
    // Matches the instant the period is typed, before the space even follows.
    assert.equal(isSceneHeadingText('int.'), true)
    assert.equal(isSceneHeadingText('EXT.'), true)
  })

  it('does not match a bare prefix without the period yet', () => {
    assert.equal(isSceneHeadingText('int'), false)
    assert.equal(isSceneHeadingText('ext'), false)
  })
})
