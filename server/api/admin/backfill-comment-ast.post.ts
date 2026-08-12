import { runTask } from 'nitropack/runtime'
import { parseBackfillCommentAstPayload } from '~/server/utils/adminTaskPayload'

type BackfillCommentAstResult = {
  scanned: number
  updated: number
  failed: Array<{ id: number; message: string }>
  touchedPaths: string[]
}

const BACKFILL_COMMENT_AST_TASK = 'backfill-comment-ast'

export default defineEventHandler(async (event): Promise<BackfillCommentAstResult> => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden.' })
  }

  const body = await readBody(event)
  const { result } = await runTask<BackfillCommentAstResult>(BACKFILL_COMMENT_AST_TASK, {
    payload: parseBackfillCommentAstPayload(body)
  })

  if (!result) {
    throw createError({ statusCode: 500, message: 'Backfill task returned no result.' })
  }

  return result
})
