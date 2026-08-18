import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getImageUrlForStorage, isValidImageUrl } from './imageUrl'

/**
 * Image URL acceptance for the project poster / character portrait fields.
 *
 * The Google Drive cases matter in both directions: `getImageUrlForStorage` rewrites a shared
 * `drive.google.com/file/d/…/view` link into a `drive.usercontent.google.com/download?id=…` direct
 * link, so `isValidImageUrl` has to accept that form too — otherwise a saved poster fails
 * validation the next time the project is edited, and pasting a direct link never works at all.
 */

const DRIVE_SHARE_URL = 'https://drive.google.com/file/d/1cLKMYrB-gYNaA6xv21My4lSehLmuX69h/view'
const DRIVE_DIRECT_URL =
  'https://drive.usercontent.google.com/download?id=1cLKMYrB-gYNaA6xv21My4lSehLmuX69h&export=view&authuser=0'

describe('isValidImageUrl', () => {
  it('accepts an empty value (the field is optional)', () => {
    assert.equal(isValidImageUrl(''), true)
    assert.equal(isValidImageUrl('   '), true)
  })

  it('accepts URLs ending in an image extension', () => {
    assert.equal(isValidImageUrl('https://example.com/poster.jpg'), true)
    assert.equal(isValidImageUrl('https://example.com/poster.PNG?v=2'), true)
  })

  it('accepts a Google Drive share link', () => {
    assert.equal(isValidImageUrl(DRIVE_SHARE_URL), true)
    assert.equal(isValidImageUrl(`${DRIVE_SHARE_URL}?usp=sharing`), true)
  })

  it('accepts a Google Drive direct download link, in any query order', () => {
    assert.equal(isValidImageUrl(DRIVE_DIRECT_URL), true)
    assert.equal(
      isValidImageUrl(
        'https://drive.usercontent.google.com/download?export=view&authuser=0&id=1cLKMYrB',
      ),
      true,
    )
    assert.equal(
      isValidImageUrl('https://drive.google.com/uc?export=view&id=1cLKMYrB'),
      true,
      'older /uc direct form',
    )
  })

  it('rejects a Drive URL with no file id', () => {
    assert.equal(isValidImageUrl('https://drive.usercontent.google.com/download?export=view'), false)
  })

  it('rejects non-http protocols and non-image pages', () => {
    assert.equal(isValidImageUrl('ftp://example.com/poster.jpg'), false)
    assert.equal(isValidImageUrl('https://example.com/some/page'), false)
    assert.equal(isValidImageUrl('not a url'), false)
  })
})

describe('getImageUrlForStorage', () => {
  it('rewrites a Drive share link to its direct download form', () => {
    assert.equal(getImageUrlForStorage(DRIVE_SHARE_URL), DRIVE_DIRECT_URL)
  })

  it('leaves an already-direct Drive link untouched', () => {
    assert.equal(getImageUrlForStorage(DRIVE_DIRECT_URL), DRIVE_DIRECT_URL)
  })

  it('round-trips: what it stores is what validation accepts', () => {
    assert.equal(isValidImageUrl(getImageUrlForStorage(DRIVE_SHARE_URL)), true)
  })

  it('trims and otherwise passes URLs through', () => {
    assert.equal(
      getImageUrlForStorage('  https://example.com/poster.jpg  '),
      'https://example.com/poster.jpg',
    )
  })
})
