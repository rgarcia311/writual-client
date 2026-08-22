import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  dataUrlByteSize,
  formatBytes,
  MAX_IMAGE_FILE_BYTES,
  validateImageFile,
} from './imageFile'
import { isValidImageUrl } from './imageUrl'

/**
 * Covers the parts of the local-file upload path that don't need a browser: what we accept off
 * disk, and how the stored size is measured. The `FileReader`/canvas steps are exercised in the app.
 */

const png = (type = 'image/png', size = 1024) => ({ name: 'poster.png', size, type })

describe('validateImageFile', () => {
  it('accepts an image within the size limit', () => {
    assert.equal(validateImageFile(png()), null)
    assert.equal(validateImageFile(png('image/jpeg')), null)
    assert.equal(validateImageFile(png('image/svg+xml')), null)
  })

  it('rejects a non-image file', () => {
    const message = validateImageFile({ name: 'script.pdf', size: 1024, type: 'application/pdf' })
    assert.match(message ?? '', /image file/i)
  })

  it('rejects a file with no type, which is how a bogus drop arrives', () => {
    assert.match(validateImageFile({ name: 'poster', size: 10, type: '' }) ?? '', /image file/i)
  })

  it('rejects an empty file', () => {
    assert.match(validateImageFile(png('image/png', 0)) ?? '', /empty/i)
  })

  it('rejects a file over the read limit and names the limit', () => {
    const message = validateImageFile(png('image/png', MAX_IMAGE_FILE_BYTES + 1))
    assert.match(message ?? '', /15\.0 MB/)
  })
})

describe('dataUrlByteSize', () => {
  it('measures the decoded payload, not the base64 string', () => {
    // "hi" -> aGk= : 4 base64 chars, 1 pad, 2 decoded bytes.
    assert.equal(dataUrlByteSize('data:image/png;base64,aGk='), 2)
    assert.equal(dataUrlByteSize('data:image/png;base64,aGlq'), 3)
    assert.equal(dataUrlByteSize('data:image/png;base64,aGVsbG8='), 5)
  })

  it('returns 0 for a payload-less value rather than a negative size', () => {
    assert.equal(dataUrlByteSize('data:image/png;base64,'), 0)
  })
})

describe('formatBytes', () => {
  it('scales the unit to the size', () => {
    assert.equal(formatBytes(512), '512 B')
    assert.equal(formatBytes(2048), '2 KB')
    assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB')
  })
})

describe('uploaded values round-trip through image URL validation', () => {
  it('accepts the data URL shape the uploader produces', () => {
    // What canvas.toDataURL('image/webp') returns, shortened.
    assert.equal(isValidImageUrl('data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAY='), true)
    assert.equal(isValidImageUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='), true)
  })
})
