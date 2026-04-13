import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { usersTable } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  // ユーザーを削除
  await db.delete(usersTable).where(eq(usersTable.id, parseInt(user.id, 10)))

  await clearUserSession(event)

  return { message: 'User deleted.' }
})
