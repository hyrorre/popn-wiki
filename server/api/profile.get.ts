import { db } from '@nuxthub/db'
import { profilesTable } from '../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }
  const data = await db.select().from(profilesTable).where(eq(profilesTable.id, user.id)).get()

  if (!data) {
    // プロフィールがまだ作成されていない場合は作成するか、nullを返す
    // ここでは単純にnullを返すか、初期値を返す
    return { id: user.id, name: user.name, avatar: user.avatar }
  }

  return data
})
