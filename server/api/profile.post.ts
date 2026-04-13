import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { usersTable } from '../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody(event)
  const now = new Date().toISOString()

  const updated = await db
    .update(usersTable)
    .set({
      name: payload.name,
      avatar: payload.avatar,
      updatedAt: now
    })
    .where(eq(usersTable.id, parseInt(user.id, 10)))
    .returning()
    .get()

  return updated
})
