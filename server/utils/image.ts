import { createError, getRequestHeader, getRequestWebStream, isError, type H3Event } from 'h3'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const
const MAX_FILENAME_LENGTH = 255
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_MULTIPART_OVERHEAD = 64 * 1024
const filenameUploadQueues = new Map<string, Promise<void>>()

export type ImageExtension = (typeof ALLOWED_EXTENSIONS)[number]

type DetectedImage = {
  extension: Exclude<ImageExtension, 'jpg'>
  contentType: string
}

type BlobMetadataReader = {
  head(pathname: string): Promise<unknown>
}

type ImageBlobStorage = BlobMetadataReader & {
  driver?: { name?: string; options?: unknown }
  put(
    pathname: string,
    body: Uint8Array,
    options: { contentType: string; addRandomSuffix: false }
  ): Promise<{ pathname: string }>
}

type ConditionalR2Bucket = {
  put(
    pathname: string,
    body: Uint8Array,
    options: {
      onlyIf: { etagDoesNotMatch: '*' }
      httpMetadata: { contentType: string }
    }
  ): Promise<unknown | null>
}

export async function readImageUpload(event: H3Event) {
  const contentType = getRequestHeader(event, 'content-type')
  if (!contentType?.startsWith('multipart/form-data')) {
    throw createError({ statusCode: 400, message: 'ファイルが指定されていません。' })
  }

  const maxBodySize = MAX_IMAGE_SIZE + MAX_MULTIPART_OVERHEAD
  const contentLength = Number(getRequestHeader(event, 'content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBodySize) {
    throwImageSizeError()
  }

  const stream = getRequestWebStream(event)
  if (!stream) {
    throw createError({ statusCode: 400, message: 'ファイルが指定されていません。' })
  }

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value)
      totalSize += chunk.byteLength
      if (totalSize > maxBodySize) {
        await reader.cancel()
        throwImageSizeError()
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  let formData: FormData
  try {
    formData = await new Response(body, { headers: { 'content-type': contentType } }).formData()
  } catch {
    throw createError({ statusCode: 400, message: 'multipart データが不正です。' })
  }

  const files = formData.getAll('file')
  if (files.length !== 1 || !(files[0] instanceof Blob) || !('name' in files[0])) {
    throw createError({ statusCode: 400, message: 'ファイルが指定されていません。' })
  }

  const file = files[0] as File
  if (!file.name || file.size === 0) {
    throw createError({ statusCode: 400, message: 'ファイルが指定されていません。' })
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throwImageSizeError()
  }

  return {
    filename: file.name,
    data: new Uint8Array(await file.arrayBuffer())
  }
}

export async function putImageIfAbsent(
  storage: ImageBlobStorage,
  filename: string,
  body: Uint8Array,
  contentType: string,
  r2Bucket?: ConditionalR2Bucket
) {
  filename = validateImageFilename(filename).filename
  if (r2Bucket) {
    const uploaded = await r2Bucket.put(filename, body, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType }
    })
    if (!uploaded) {
      throwImageFilenameConflict(filename)
    }

    return { pathname: filename }
  }

  return withFilenameUploadLock(filename, async () => {
    await ensureImageFilenameAvailable(storage, filename)
    return storage.put(filename, body, { contentType, addRandomSuffix: false })
  })
}

export function getConditionalR2Bucket(event: H3Event, storage: ImageBlobStorage) {
  if (storage.driver?.name !== 'cloudflare-r2') {
    return undefined
  }

  const driverOptions = storage.driver.options as { binding?: string } | undefined
  const binding = driverOptions?.binding || 'BLOB'
  const eventEnv = (event.context.cloudflare as { env?: Record<string, unknown> } | undefined)?.env
  const globals = globalThis as unknown as Record<string, unknown> & { __env__?: Record<string, unknown> }
  const candidate = eventEnv?.[binding] ?? globals.__env__?.[binding] ?? globals[binding]

  if (candidate && typeof (candidate as ConditionalR2Bucket).put === 'function') {
    return candidate as ConditionalR2Bucket
  }

  throw new Error(`R2 binding "${binding}" is unavailable.`)
}

export async function ensureImageFilenameAvailable(storage: BlobMetadataReader, filename: string) {
  try {
    await storage.head(filename)
  } catch (error) {
    if (isError(error) && error.statusCode === 404) {
      return
    }

    throw error
  }

  throw createError({
    statusCode: 409,
    message: `同名のファイルが既に存在します: ${filename}`
  })
}

async function withFilenameUploadLock<T>(filename: string, operation: () => Promise<T>) {
  const previous = filenameUploadQueues.get(filename) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const queued = previous.then(() => gate)
  filenameUploadQueues.set(filename, queued)

  await previous
  try {
    return await operation()
  } finally {
    release()
    if (filenameUploadQueues.get(filename) === queued) {
      filenameUploadQueues.delete(filename)
    }
  }
}

function throwImageFilenameConflict(filename: string): never {
  throw createError({
    statusCode: 409,
    message: `同名のファイルが既に存在します: ${filename}`
  })
}

function throwImageSizeError(): never {
  throw createError({ statusCode: 400, message: 'ファイルサイズは5MB以下にしてください。' })
}

export function validateImageFilename(filename: string) {
  let trimmed: string
  try {
    trimmed = decodeURIComponent(filename.trim())
  } catch {
    throw createError({ statusCode: 400, message: 'ファイル名のエンコードが不正です。' })
  }

  if (!trimmed || trimmed.length > MAX_FILENAME_LENGTH) {
    throw createError({ statusCode: 400, message: 'ファイル名が不正です。' })
  }

  if (
    trimmed.startsWith('.') ||
    trimmed.includes('%') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0') ||
    hasControlCharacter(trimmed)
  ) {
    throw createError({ statusCode: 400, message: 'ファイル名に使用できない文字が含まれています。' })
  }

  const ext = getImageExtension(trimmed)
  if (!ext) {
    throw createError({
      statusCode: 400,
      message: `許可されていないファイル形式です。(${ALLOWED_EXTENSIONS.join(', ')})`
    })
  }

  return {
    filename: trimmed,
    extension: ext
  }
}

export function validateImageContent(data: Uint8Array, filenameExtension: ImageExtension) {
  const detected = detectImageType(data)

  if (!detected) {
    throw createError({ statusCode: 400, message: '画像ファイルとして認識できません。' })
  }

  if (!extensionsMatch(filenameExtension, detected.extension)) {
    throw createError({ statusCode: 400, message: '拡張子とファイル内容が一致しません。' })
  }

  return detected
}

function getImageExtension(filename: string): ImageExtension | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext as ImageExtension) ? (ext as ImageExtension) : null
}

function detectImageType(data: Uint8Array): DetectedImage | null {
  if (startsWithBytes(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: 'png', contentType: 'image/png' }
  }

  if (startsWithBytes(data, [0xff, 0xd8, 0xff])) {
    return { extension: 'jpeg', contentType: 'image/jpeg' }
  }

  if (startsWithAscii(data, 'GIF87a') || startsWithAscii(data, 'GIF89a')) {
    return { extension: 'gif', contentType: 'image/gif' }
  }

  if (
    data.length >= 12 &&
    startsWithAscii(data, 'RIFF') &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return { extension: 'webp', contentType: 'image/webp' }
  }

  return null
}

function extensionsMatch(filenameExtension: ImageExtension, detectedExtension: DetectedImage['extension']) {
  if (detectedExtension === 'jpeg') {
    return filenameExtension === 'jpg' || filenameExtension === 'jpeg'
  }

  return filenameExtension === detectedExtension
}

function startsWithBytes(data: Uint8Array, bytes: number[]) {
  return bytes.every((byte, index) => data[index] === byte)
}

function startsWithAscii(data: Uint8Array, value: string) {
  if (data.length < value.length) return false

  for (let index = 0; index < value.length; index++) {
    if (data[index] !== value.charCodeAt(index)) {
      return false
    }
  }

  return true
}

function hasControlCharacter(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) {
      return true
    }
  }
  return false
}
