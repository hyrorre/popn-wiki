import { runTask } from 'nitropack/runtime'
import { parseRebuildPageSearchPayload } from '~/server/utils/adminTaskPayload'
import { requireApiAdmin } from '~/server/utils/authorization'

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
  await requireApiAdmin(event)

  const body = await readBody(event)
  const { result } = await runTask<RebuildPageSearchFtsResult>(REBUILD_PAGE_SEARCH_FTS_TASK, {
    payload: parseRebuildPageSearchPayload(body)
  })

  if (!result) {
    throw createError({ statusCode: 500, message: 'Search index rebuild task returned no result.' })
  }

  return result
})
