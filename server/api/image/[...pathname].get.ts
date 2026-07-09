import { blob } from '@nuxthub/blob'
import { getRouterParam } from 'h3'
import { CDN_CACHE_TTL, setPublicCdnCacheHeaders } from '~/server/utils/cacheHeaders'

export default defineEventHandler(async (event) => {
  // `[...pathname]` は `string[]` で受け取られることがあるため `/` 連結してパス文字列に戻す。
  const pathnameParam = getRouterParam(event, 'pathname')
  const pathname = Array.isArray(pathnameParam) ? pathnameParam.join('/') : String(pathnameParam || '')

  if (!pathname) {
    throw createError({ statusCode: 400, message: 'Missing pathname.' })
  }

  const body = await blob.serve(event, pathname)
  setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.image, { browser: 'same', immutable: true })
  return body
})
