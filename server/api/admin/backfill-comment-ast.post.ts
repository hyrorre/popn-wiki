import { runTask } from 'nitropack/runtime'

type BackfillCommentAstBody = {
  limit?: unknown
  path?: unknown
}

type BackfillCommentAstResult = {
  scanned: number
  updated: number
  failed: Array<{ id: number; message: string }>
  touchedPaths: string[]
}

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export default defineEventHandler(async (event): Promise<BackfillCommentAstResult> => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden.' })
  }

  const body = await readBody<BackfillCommentAstBody>(event)
  const { result } = await runTask<BackfillCommentAstResult>('comments:backfill-ast', {
    payload: parsePayload(body)
  })

  if (!result) {
    throw createError({ statusCode: 500, message: 'Backfill task returned no result.' })
  }

  return result
})

function parsePayload(body: BackfillCommentAstBody | undefined) {
  const rawLimit = Number(body?.limit ?? DEFAULT_LIMIT)
  const path = typeof body?.path === 'string' ? body.path.trim() : ''

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT) : DEFAULT_LIMIT,
    ...(path ? { path } : {})
  }
}
