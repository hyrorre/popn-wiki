import { runTask } from 'nitropack/runtime'
import { parseRebuildPageSearchPayload } from '~/server/utils/adminTaskPayload'

type RebuildPageSearchFtsResult = {
  scanned: number
  indexed: number
  done: boolean
  reset: boolean
  nextCursor?: string
  skipped?: string
}

const REBUILD_PAGE_SEARCH_FTS_TASK = 'rebuild-page-search-fts'

export default defineEventHandler(async (event): Promise<RebuildPageSearchFtsResult> => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden.' })
  }

  const body = await readBody(event)
  const { result } = await runTask<RebuildPageSearchFtsResult>(REBUILD_PAGE_SEARCH_FTS_TASK, {
    payload: parseRebuildPageSearchPayload(body)
  })

  if (!result) {
    throw createError({ statusCode: 500, message: 'Search index rebuild task returned no result.' })
  }

  return result
})
