import { blob } from '@nuxthub/blob'
import { getRouterParam } from 'h3'

const IMAGE_CACHE_CONTROL = 'public, max-age=2592000, immutable'

export default defineEventHandler(async (event) => {
  // `[...pathname]` は `string[]` で受け取られることがあるため `/` 連結してパス文字列に戻す。
  const pathnameParam = getRouterParam(event, 'pathname')
  const pathname = Array.isArray(pathnameParam) ? pathnameParam.join('/') : String(pathnameParam || '')

  if (!pathname) {
    throw createError({ statusCode: 400, message: 'Missing pathname.' })
  }

  setResponseHeader(event, 'Cache-Control', IMAGE_CACHE_CONTROL)
  setResponseHeader(event, 'CDN-Cache-Control', IMAGE_CACHE_CONTROL)

  return blob.serve(event, pathname)
})
