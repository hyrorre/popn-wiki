const DEFAULT_BACKFILL_LIMIT = 100
const MAX_BACKFILL_LIMIT = 500
const DEFAULT_REBUILD_LIMIT = 50
const MAX_REBUILD_LIMIT = 200

export function parseBackfillCommentAstPayload(body: { limit?: unknown; path?: unknown } | undefined) {
  const path = typeof body?.path === 'string' ? body.path.trim() : ''

  return {
    limit: clampLimit(body?.limit, DEFAULT_BACKFILL_LIMIT, MAX_BACKFILL_LIMIT),
    ...(path ? { path } : {})
  }
}

export function parseRebuildPageSearchPayload(
  body: { reset?: unknown; limit?: unknown; cursor?: unknown } | undefined
) {
  const cursor = typeof body?.cursor === 'string' ? body.cursor.trim() : ''
  const reset = typeof body?.reset === 'boolean' ? body.reset : !cursor

  return {
    limit: clampLimit(body?.limit, DEFAULT_REBUILD_LIMIT, MAX_REBUILD_LIMIT),
    reset,
    ...(cursor ? { cursor } : {})
  }
}

function clampLimit(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), maximum) : fallback
}
