import { runTask } from 'nitropack/runtime'

type RebuildPageSearchFtsResult = {
  indexed: number
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

  const { result } = await runTask<RebuildPageSearchFtsResult>(REBUILD_PAGE_SEARCH_FTS_TASK)

  if (!result) {
    throw createError({ statusCode: 500, message: 'Search index rebuild task returned no result.' })
  }

  return result
})
