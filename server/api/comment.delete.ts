import { commentsTable } from '../db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { requireApiUser } from '~/server/utils/authorization'
import { invalidateCommentMutationCaches } from '~/server/utils/mutationCache'
import { parseStrictIntegerQuery } from '~/server/utils/queryInteger'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  const query = getQuery(event)
  const id = parseStrictIntegerQuery(query.id, { minimum: 1, message: 'ID is required.' })

  const isAdmin = user.role === 'admin'

  const target = await db
    .select({
      id: commentsTable.id,
      path: commentsTable.path,
      userId: commentsTable.userId,
      deletedAt: commentsTable.deletedAt
    })
    .from(commentsTable)
    .where(and(eq(commentsTable.id, id), isNull(commentsTable.deletedAt)))
    .get()

  if (!target) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  if (!isAdmin && target.userId !== user.id) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  const now = new Date().toISOString()

  const deleted = await db.all<{ id: number; path: string }>(sql`
    WITH RECURSIVE subtree(id) AS (
      SELECT id
      FROM comments
      WHERE id = ${id}
        AND deleted_at IS NULL
      UNION
      SELECT child.id
      FROM comments AS child
      INNER JOIN subtree ON child.reply_to = subtree.id
    )
    UPDATE comments
    SET deleted_at = ${now}
    WHERE id IN (SELECT id FROM subtree)
      AND deleted_at IS NULL
    RETURNING id, path
  `)

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  await invalidateCommentMutationCaches(event, target.path, 'delete')

  return { success: true, deletedCount: deleted.length }
})
