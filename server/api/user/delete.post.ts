import { usersTable, tokensTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { getCommentPathsByUser, invalidateCommentAuthorCaches } from '~/server/utils/commentAuthorCache'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const commentPaths = await getCommentPathsByUser(user.id)
  await db.delete(tokensTable).where(eq(tokensTable.userId, user.id))
  await db.delete(usersTable).where(eq(usersTable.id, user.id))

  await invalidateCommentAuthorCaches(event, commentPaths)
  await clearUserSession(event)

  return { message: 'User deleted.' }
})
