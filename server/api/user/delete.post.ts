import { usersTable, tokensTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { getCommentPathsByUser, invalidateCommentAuthorCaches } from '~/server/utils/commentAuthorCache'
import { requireApiUser } from '~/server/utils/authorization'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  const commentPaths = await getCommentPathsByUser(user.id)
  await db.delete(tokensTable).where(eq(tokensTable.userId, user.id))
  await db.delete(usersTable).where(eq(usersTable.id, user.id))

  await invalidateCommentAuthorCaches(event, commentPaths)
  await clearUserSession(event)

  return { message: 'User deleted.' }
})
