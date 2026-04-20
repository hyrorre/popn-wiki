import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  // ユーザーを削除
  await db.delete(usersTable).where(eq(usersTable.id, user.id))

  await clearUserSession(event)

  return { message: 'User deleted.' }
})
