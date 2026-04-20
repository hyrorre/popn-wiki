import { blob } from '@nuxthub/blob'
import { checkRateLimit } from '~/server/utils/rateLimit'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'image:post', limit: 10 })
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const formData = await readMultipartFormData(event)
  const file = formData?.find((f) => f.name === 'file')

  if (!file || !file.filename || !file.data?.length) {
    throw createError({ statusCode: 400, message: 'ファイルが指定されていません。' })
  }

  // 拡張子チェック
  const ext = file.filename.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw createError({
      statusCode: 400,
      message: `許可されていないファイル形式です。(${ALLOWED_EXTENSIONS.join(', ')})`
    })
  }

  // サイズチェック
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: 'ファイルサイズは5MB以下にしてください。' })
  }

  // オリジナルファイル名をそのまま使用
  try {
    // `readMultipartFormData()` は `file.data` に Node.js `Buffer` を渡すことがあり、
    // Cloudflare R2（miniflare）が受け取りにくい場合があるため `ArrayBuffer` に正規化する。
    const data = file.data
    const body =
      // `Buffer` をそのまま渡すと miniflare 側の R2 実装でコケることがあるため、
      // 常にコピーした `Uint8Array` を渡す。
      data instanceof Uint8Array ? new Uint8Array(data) : data

    const putBlob = await blob.put(file.filename, body, {
      contentType: file.type || 'application/octet-stream',
      addRandomSuffix: false // 既存のコードが同名チェックをしているため
    })

    return {
      url: putBlob.pathname,
      filename: file.filename
    }
  } catch (err) {
    const error = err as { message?: string }
    // デバッグ用: miniflare / R2 側の詳細をコンソールに出す
    console.error('blob.put failed:', err)
    if (error.message?.includes('already exists')) {
      throw createError({
        statusCode: 409,
        message: `同名のファイルが既に存在します: ${file.filename}`
      })
    }
    throw createError({ statusCode: 500, message: error.message || 'Internal Server Error' })
  }
})
