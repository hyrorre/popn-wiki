import { describe, expect, test } from 'bun:test'
import { createError } from 'h3'
import { ensureImageFilenameAvailable, validateImageContent, validateImageFilename } from '../server/utils/image'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const gif = new TextEncoder().encode('GIF89a')
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])

describe('Image upload validation', () => {
  test('accepts safe original filenames', () => {
    expect(validateImageFilename('score_001.png')).toEqual({ filename: 'score_001.png', extension: 'png' })
    expect(validateImageFilename('ポップン譜面.webp')).toEqual({ filename: 'ポップン譜面.webp', extension: 'webp' })
  })

  test('rejects dangerous filenames', () => {
    expect(() => validateImageFilename('../secret.png')).toThrow()
    expect(() => validateImageFilename('foo/bar.png')).toThrow()
    expect(() => validateImageFilename('\\evil.png')).toThrow()
    expect(() => validateImageFilename('.hidden.png')).toThrow()
    expect(() => validateImageFilename('image.exe')).toThrow()
  })

  test('detects image content types from magic bytes', () => {
    expect(validateImageContent(png, 'png').contentType).toBe('image/png')
    expect(validateImageContent(jpeg, 'jpg').contentType).toBe('image/jpeg')
    expect(validateImageContent(jpeg, 'jpeg').contentType).toBe('image/jpeg')
    expect(validateImageContent(gif, 'gif').contentType).toBe('image/gif')
    expect(validateImageContent(webp, 'webp').contentType).toBe('image/webp')
  })

  test('rejects content that does not match the extension', () => {
    expect(() => validateImageContent(new TextEncoder().encode('not an image'), 'png')).toThrow()
    expect(() => validateImageContent(png, 'webp')).toThrow()
  })

  test('allows a filename that does not exist in blob storage', async () => {
    const storage = {
      async head() {
        throw createError({ statusCode: 404, message: 'Blob not found' })
      }
    }

    await expect(ensureImageFilenameAvailable(storage, 'new.png')).resolves.toBeUndefined()
  })

  test('rejects a filename that already exists in blob storage', async () => {
    const storage = {
      async head() {
        return { pathname: 'existing.png' }
      }
    }

    await expect(ensureImageFilenameAvailable(storage, 'existing.png')).rejects.toMatchObject({ statusCode: 409 })
  })

  test('does not hide blob storage failures', async () => {
    const failure = new Error('R2 is unavailable')
    const storage = {
      async head() {
        throw failure
      }
    }

    await expect(ensureImageFilenameAvailable(storage, 'new.png')).rejects.toBe(failure)
  })
})
