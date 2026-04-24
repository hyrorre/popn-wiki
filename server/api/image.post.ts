import { blob } from '@nuxthub/blob'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { validateImageContent, validateImageFilename } from '~/server/utils/image'

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

  const { filename, extension } = validateImageFilename(file.filename)

  // サイズチェック
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: 'ファイルサイズは5MB以下にしてください。' })
  }

  const data = file.data
  const body =
    // `Buffer` をそのまま渡すと miniflare 側の R2 実装でコケることがあるため、
    // 常にコピーした `Uint8Array` を渡す。
    data instanceof Uint8Array ? new Uint8Array(data) : data
  const image = validateImageContent(body, extension)

  try {
    // オリジナルファイル名をそのまま使用
    const putBlob = await blob.put(filename, body, {
      contentType: image.contentType,
      addRandomSuffix: false // 既存のコードが同名チェックをしているため
    })

    return {
      url: putBlob.pathname,
      filename
    }
  } catch (err) {
    const error = err as { message?: string }
    // デバッグ用: miniflare / R2 側の詳細をコンソールに出す
    console.error('blob.put failed:', err)
    if (error.message?.includes('already exists')) {
      throw createError({
        statusCode: 409,
        message: `同名のファイルが既に存在します: ${filename}`
      })
    }
    throw createError({ statusCode: 500, message: error.message || 'Internal Server Error' })
  }
})
