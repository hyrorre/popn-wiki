import { runTask } from 'nitropack/runtime'

type RebuildPageSearchFtsBody = {
  reset?: unknown
  limit?: unknown
  cursor?: unknown
}

type RebuildPageSearchFtsResult = {
  scanned: number
  indexed: number
  done: boolean
  reset: boolean
  nextCursor?: string
  skipped?: string
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const REBUILD_PAGE_SEARCH_FTS_TASK = 'rebuild-page-search-fts'

export default defineEventHandler(async (event): Promise<RebuildPageSearchFtsResult> => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden.' })
  }

  const body = await readBody<RebuildPageSearchFtsBody>(event)
  const { result } = await runTask<RebuildPageSearchFtsResult>(REBUILD_PAGE_SEARCH_FTS_TASK, {
    payload: parsePayload(body)
  })

  if (!result) {
    throw createError({ statusCode: 500, message: 'Search index rebuild task returned no result.' })
  }

  return result
})

function parsePayload(body: RebuildPageSearchFtsBody | undefined) {
  const rawLimit = Number(body?.limit ?? DEFAULT_LIMIT)
  const cursor = typeof body?.cursor === 'string' ? body.cursor.trim() : ''
  const reset = typeof body?.reset === 'boolean' ? body.reset : !cursor

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT) : DEFAULT_LIMIT,
    reset,
    ...(cursor ? { cursor } : {})
  }
}
