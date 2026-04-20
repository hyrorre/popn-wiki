import { usersTable } from '../db/schema'
import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { readZodBody } from '~/server/utils/validation'
import { updateProfileSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readZodBody(event, updateProfileSchema)
  const now = new Date().toISOString()

  const updated = await db
    .update(usersTable)
    .set({
      name: payload.name,
      avatar: payload.avatar,
      updatedAt: now
    })
    .where(eq(usersTable.id, user.id))
    .returning()
    .get()

  return updated
})
