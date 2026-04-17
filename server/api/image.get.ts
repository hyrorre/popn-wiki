import { blob } from '@nuxthub/blob'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number(query.limit) || 1000
  const cursor = query.cursor as string | undefined

  const config = useRuntimeConfig()
  const basePath = String(config.public.imageBasePath || '/api/image').replace(/\/$/, '')
  const result = await blob.list({ limit, cursor })

  const images = result.blobs.map((b) => {
    return {
      name: b.pathname,
      url: `${basePath}/${String(b.pathname).replace(/^\/+/, '')}`,
      created_at: b.uploadedAt
    }
  })

  return {
    images,
    cursor: result.cursor,
    hasMore: result.hasMore
  }
})
