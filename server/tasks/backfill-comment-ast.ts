import { db } from '@nuxthub/db'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { commentsTable } from '../db/schema'
import { parseBackfillCommentAstPayload } from '../utils/adminTaskPayload'
import { invalidateCommentListCache } from '../utils/commentCache'
import { parseSafeMarkdown } from '../utils/markdown'
import { MARKDOWN_RENDER_VERSION, MARKDOWN_TABLE_LAYOUT_VERSION } from '~/utils/markdown-security'

export default defineTask({
  meta: {
    name: 'backfill-comment-ast',
    description: 'Backfill missing or outdated comment Markdown ASTs in small batches'
  },
  async run({ payload }) {
    const { limit, path } = parseBackfillCommentAstPayload(payload)
    const whereClause = path
      ? and(bodyAstIsOutdated(), isNull(commentsTable.deletedAt), eq(commentsTable.path, path), bodyIsNotEmpty())
      : and(bodyAstIsOutdated(), isNull(commentsTable.deletedAt), bodyIsNotEmpty())

    const comments = await db
      .select({
        id: commentsTable.id,
        path: commentsTable.path,
        body: commentsTable.body
      })
      .from(commentsTable)
      .where(whereClause)
      .orderBy(asc(commentsTable.id))
      .limit(limit)
      .all()

    const touchedPaths = new Set<string>()
    let updated = 0
    const failed: Array<{ id: number; message: string }> = []

    for (const comment of comments) {
      try {
        const { sanitizedMarkdown, ast } = await parseSafeMarkdown(comment.body)
        await db
          .update(commentsTable)
          .set({ body: sanitizedMarkdown, bodyAst: JSON.stringify(ast) })
          .where(eq(commentsTable.id, comment.id))
          .execute()

        touchedPaths.add(comment.path)
        updated++
      } catch (error) {
        failed.push({
          id: comment.id,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    await Promise.all([...touchedPaths].map((path) => invalidateCommentListCache(path)))

    return {
      result: {
        scanned: comments.length,
        updated,
        failed,
        touchedPaths: [...touchedPaths]
      }
    }
  }
})

function bodyIsNotEmpty() {
  return sql`${commentsTable.body} != ''`
}

// isMarkdownAstOutdated と同じ判定。CASE で順に評価し、不正な JSON を json_extract に渡さない。
function bodyAstIsOutdated() {
  const bodyAst = commentsTable.bodyAst
  return sql`CASE
    WHEN ${bodyAst} IS NULL OR json_valid(${bodyAst}) = 0 THEN 1
    WHEN json_type(${bodyAst}) != 'object' THEN 1
    WHEN json_type(${bodyAst}, '$.renderVersion') IS NOT 'integer'
      OR json_extract(${bodyAst}, '$.renderVersion') < ${MARKDOWN_RENDER_VERSION} THEN 1
    WHEN json_type(${bodyAst}, '$.tableLayoutVersion') IS NOT 'integer'
      OR json_extract(${bodyAst}, '$.tableLayoutVersion') < ${MARKDOWN_TABLE_LAYOUT_VERSION} THEN 1
    ELSE 0
  END = 1`
}
