import { usersTable } from '../db/schema'
import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { readZodBody } from '~/server/utils/validation'
import { getCommentPathsByUser, invalidateCommentAuthorCaches } from '~/server/utils/commentAuthorCache'
import { updateProfileSchema } from '~/shared/zod'
import { requireApiUser } from '~/server/utils/authorization'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  const payload = await readZodBody(event, updateProfileSchema)
  const commentPaths = await getCommentPathsByUser(user.id)
  const now = new Date().toISOString()

  const updated = await db
    .update(usersTable)
    .set({
      name: payload.name,
      avatar: payload.avatar,
      updatedAt: now
    })
    .where(eq(usersTable.id, user.id))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      avatar: usersTable.avatar
    })
    .get()

  await invalidateCommentAuthorCaches(event, commentPaths)
  return updated
})
