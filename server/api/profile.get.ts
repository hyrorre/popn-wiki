import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { usersTable } from '../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }
  const data = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parseInt(user.id, 10)))
    .get()

  if (!data) {
    return { id: user.id, name: user.name, avatar: user.avatar }
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    avatar: user.avatar // セッションから取得
  }
})
