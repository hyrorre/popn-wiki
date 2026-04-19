import { commentsTable } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody(event)
  const id = payload.id

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID is required.' })
  }
  const now = new Date().toISOString()

  const updated = await db
    .update(commentsTable)
    .set({
      deletedAt: now
    })
    .where(and(eq(commentsTable.id, id), eq(commentsTable.userId, parseInt(user.id))))
    .returning()
    .get()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  return { success: true }
})
