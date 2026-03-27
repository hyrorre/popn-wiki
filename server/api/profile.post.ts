import { profilesTable } from '../db/schema'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody(event)
  const now = new Date().toISOString()

  const updated = await db
    .insert(profilesTable)
    .values({
      id: user.id,
      name: payload.name,
      avatar: payload.avatar,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: profilesTable.id,
      set: {
        name: payload.name,
        avatar: payload.avatar,
        updatedAt: now
      }
    })
    .returning()
    .get()

  return updated
})
