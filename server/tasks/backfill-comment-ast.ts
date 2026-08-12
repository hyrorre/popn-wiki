import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { db } from '@nuxthub/db'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { commentsTable } from '../db/schema'
import { parseBackfillCommentAstPayload } from '../utils/adminTaskPayload'
import { invalidateCommentListCache } from '../utils/commentCache'
import { mdcParseOptions } from '../utils/markdown'

export default defineTask({
  meta: {
    name: 'backfill-comment-ast',
    description: 'Backfill missing comment Markdown ASTs in small batches'
  },
  async run({ payload }) {
    const { limit, path } = parseBackfillCommentAstPayload(payload)
    const whereClause = path
      ? and(isNull(commentsTable.bodyAst), isNull(commentsTable.deletedAt), eq(commentsTable.path, path), bodyIsNotEmpty())
      : and(isNull(commentsTable.bodyAst), isNull(commentsTable.deletedAt), bodyIsNotEmpty())

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
        const ast = await parseMarkdown(comment.body, mdcParseOptions)
        await db
          .update(commentsTable)
          .set({ bodyAst: JSON.stringify(ast) })
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
