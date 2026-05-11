import { commentsTable } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { invalidateCommentListCache } from '~/server/utils/commentCache'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const query = getQuery(event)
  const id = query.id !== undefined ? Number(query.id) : undefined

  if (!id || !Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'ID is required.' })
  }
  const now = new Date().toISOString()

  const updated = await db
    .update(commentsTable)
    .set({
      deletedAt: now
    })
    .where(and(eq(commentsTable.id, id), eq(commentsTable.userId, user.id)))
    .returning()
    .get()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  await invalidateCommentListCache(updated.path)

  return { success: true }
})
