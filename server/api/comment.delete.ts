import { commentsTable } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { requireApiUser } from '~/server/utils/authorization'
import { invalidateCommentMutationCaches } from '~/server/utils/mutationCache'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  const query = getQuery(event)
  const id = query.id !== undefined ? Number(query.id) : undefined

  if (!id || !Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'ID is required.' })
  }

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

  const updated = await db
    .update(commentsTable)
    .set({
      deletedAt: now
    })
    .where(eq(commentsTable.id, id))
    .returning()
    .get()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  await invalidateCommentMutationCaches(event, updated.path, 'delete')

  return { success: true }
})
