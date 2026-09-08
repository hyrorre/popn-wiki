import { describe, expect, test } from 'bun:test'
import { createError } from 'h3'
import { createBlobStorage } from '@nuxthub/core/blob'
import { createDriver } from '@nuxthub/core/blob/drivers/cloudflare-r2'
import {
  ensureImageFilenameAvailable,
  putImageIfAbsent,
  validateImageContent,
  validateImageFilename
} from '../server/utils/image'

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

  test('normalizes encoded names before validation and rejects ambiguous encodings', () => {
    expect(validateImageFilename('chart%20copy.png').filename).toBe('chart copy.png')
    for (const filename of ['%2e%2e%2fsecret.png', 'foo%5cbar.png', 'foo%00.png', 'bad%.png', 'chart%2520copy.png']) {
      expect(() => validateImageFilename(filename)).toThrow()
    }
  })

  test('uses the canonical key for R2 writes and alias conflicts', async () => {
    const objects = new Map<string, Uint8Array>()
    const storage = {
      async head() { throw new Error('R2 uses conditional writes') },
      async put() { throw new Error('R2 uses conditional writes') }
    }
    const bucket = {
      async put(key: string, body: Uint8Array) {
        if (objects.has(key)) return null
        objects.set(key, body)
        return { key }
      }
    }
    const result = await putImageIfAbsent(storage, 'chart%20copy.png', png, 'image/png', bucket)
    expect(result.pathname).toBe('chart copy.png')
    const binding = '__IMAGE_ROUNDTRIP_TEST_BUCKET__'
    Object.defineProperty(globalThis, binding, {
      configurable: true,
      value: {
        async get(key: string) {
          const bytes = objects.get(key)
          return bytes ? { arrayBuffer: async () => bytes.buffer, httpMetadata: { contentType: 'image/png' } } : null
        }
      }
    })
    try {
      const reader = createBlobStorage(createDriver({ binding }))
      const image = await reader.get(result.pathname)
      expect(image).not.toBeNull()
      expect(new Uint8Array(await image!.arrayBuffer())).toEqual(png)
    } finally {
      Reflect.deleteProperty(globalThis, binding)
    }
    await expect(putImageIfAbsent(storage, 'chart copy.png', png, 'image/png', bucket))
      .rejects.toMatchObject({ statusCode: 409 })
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

  test('serializes fallback-driver writes so concurrent uploads cannot overwrite', async () => {
    let exists = false
    let writes = 0
    const storage = {
      async head() {
        if (!exists) {
          throw createError({ statusCode: 404, message: 'Blob not found' })
        }
        return { pathname: 'race.png' }
      },
      async put(pathname: string) {
        await Promise.resolve()
        exists = true
        writes += 1
        return { pathname }
      }
    }

    const results = await Promise.allSettled([
      putImageIfAbsent(storage, 'race.png', png, 'image/png'),
      putImageIfAbsent(storage, 'race.png', png, 'image/png')
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')?.reason).toMatchObject({ statusCode: 409 })
    expect(writes).toBe(1)
  })

  test('uses an atomic conditional write when an R2 bucket is available', async () => {
    let writes = 0
    const storage = {
      async head() {
        throw new Error('head should not be called')
      },
      async put() {
        throw new Error('fallback put should not be called')
      }
    }
    const r2Bucket = {
      async put() {
        writes += 1
        return writes === 1 ? { key: 'atomic.png' } : null
      }
    }

    await expect(putImageIfAbsent(storage, 'atomic.png', png, 'image/png', r2Bucket)).resolves.toEqual({
      pathname: 'atomic.png'
    })
    await expect(putImageIfAbsent(storage, 'atomic.png', png, 'image/png', r2Bucket)).rejects.toMatchObject({
      statusCode: 409
    })
  })
})
