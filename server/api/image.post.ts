import { blob } from '@nuxthub/blob'
import { checkRateLimit } from '~/server/utils/rateLimit'
import {
  getConditionalR2Bucket,
  putImageIfAbsent,
  readImageUpload,
  validateImageContent,
  validateImageFilename
} from '~/server/utils/image'
import { requireApiUser } from '~/server/utils/authorization'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'image:post', limit: 10 })
  await requireApiUser(event)

  const upload = await readImageUpload(event)
  const { filename, extension } = validateImageFilename(upload.filename)
  const body = upload.data
  const image = validateImageContent(body, extension)

  try {
    const putBlob = await putImageIfAbsent(
      blob,
      filename,
      body,
      image.contentType,
      getConditionalR2Bucket(event, blob)
    )

    return {
      url: putBlob.pathname,
      filename
    }
  } catch (error) {
    if (isError(error) && error.statusCode === 409) {
      throw error
    }

    const errorId = crypto.randomUUID()
    console.error(`[ImageUpload:${errorId}] Failed to store image:`, error)
    throw createError({
      statusCode: 503,
      message: '画像の保存に失敗しました。時間をおいて再試行してください。',
      data: { errorId }
    })
  }
})
