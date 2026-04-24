const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const
const MAX_FILENAME_LENGTH = 255

export type ImageExtension = (typeof ALLOWED_EXTENSIONS)[number]

type DetectedImage = {
  extension: Exclude<ImageExtension, 'jpg'>
  contentType: string
}

export function validateImageFilename(filename: string) {
  const trimmed = filename.trim()

  if (!trimmed || trimmed.length > MAX_FILENAME_LENGTH) {
    throw createError({ statusCode: 400, message: 'ファイル名が不正です。' })
  }

  if (
    trimmed.startsWith('.') ||
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
