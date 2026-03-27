import { commentsTable, profilesTable } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody(event)
  const id = payload.id
  const body = payload.body?.trim()

  if (!id || !body) {
    throw createError({ statusCode: 400, message: 'ID and body are required.' })
  }
  const now = new Date().toISOString()
  
  const updated = await db
    .update(commentsTable)
    .set({ 
      body, 
      updatedAt: now 
    })
    .where(and(eq(commentsTable.id, id), eq(commentsTable.userId, user.id)))
    .returning()
    .get()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  const profile = await db.select().from(profilesTable).where(eq(profilesTable.id, user.id)).get()

  return {
    ...updated,
    profiles: profile
  }
})
