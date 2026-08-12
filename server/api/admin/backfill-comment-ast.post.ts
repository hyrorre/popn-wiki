import { runTask } from 'nitropack/runtime'
import { parseBackfillCommentAstPayload } from '~/server/utils/adminTaskPayload'
import { requireApiAdmin } from '~/server/utils/authorization'

type BackfillCommentAstResult = {
  scanned: number
  updated: number
  failed: Array<{ id: number; message: string }>
  touchedPaths: string[]
}

const BACKFILL_COMMENT_AST_TASK = 'backfill-comment-ast'

export default defineEventHandler(async (event): Promise<BackfillCommentAstResult> => {
  await requireApiAdmin(event)

  const body = await readBody(event)
  const { result } = await runTask<BackfillCommentAstResult>(BACKFILL_COMMENT_AST_TASK, {
    payload: parseBackfillCommentAstPayload(body)
  })

  if (!result) {
    throw createError({ statusCode: 500, message: 'Backfill task returned no result.' })
  }

  return result
})
