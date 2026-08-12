import { blob } from '@nuxthub/blob'

const MAX_LIMIT = 1000
const FALLBACK_CURSOR_PREFIX = 'offset:'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseLimit(query.limit)
  const cursor = query.cursor as string | undefined
  const fallbackOffset = parseFallbackCursor(cursor)

  const config = useRuntimeConfig()
  const basePath = String(config.public.imageBasePath || '/api/image').replace(/\/$/, '')
  const result = await blob.list(fallbackOffset === null ? { limit, cursor } : { limit: MAX_LIMIT })
  const fallbackPagination =
    fallbackOffset !== null || (!result.hasMore && !result.cursor && result.blobs.length > limit)
  const allBlobs = fallbackPagination
    ? [...result.blobs].sort((left, right) => left.pathname.localeCompare(right.pathname))
    : result.blobs
  const offset = fallbackOffset ?? 0
  const selectedBlobs = fallbackPagination ? allBlobs.slice(offset, offset + limit) : allBlobs
  const hasMore = fallbackPagination ? offset + limit < allBlobs.length : result.hasMore
  const nextCursor = fallbackPagination && hasMore ? `${FALLBACK_CURSOR_PREFIX}${offset + limit}` : result.cursor

  const images = selectedBlobs.map((b) => {
    return {
      name: b.pathname,
      url: `${basePath}/${String(b.pathname).replace(/^\/+/, '')}`,
      created_at: b.uploadedAt
    }
  })

  return {
    images,
    cursor: nextCursor,
    hasMore
  }
})

function parseLimit(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return MAX_LIMIT
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT)
}

function parseFallbackCursor(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith(FALLBACK_CURSOR_PREFIX)) return null

  const offset = Number(value.slice(FALLBACK_CURSOR_PREFIX.length))
  return Number.isInteger(offset) && offset >= 0 ? offset : null
}
