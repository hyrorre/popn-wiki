import { commentsTable, usersTable } from '../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody(event)
  const path = payload.path?.trim()
  const body = payload.body?.trim()
  const replyTo = payload.replyTo || null

  if (!path || !body) {
    throw createError({ statusCode: 400, message: 'Path and body are required.' })
  }
  const now = new Date().toISOString()

  const inserted = await db
    .insert(commentsTable)
    .values({
      path,
      body,
      replyTo,
      userId: parseInt(user.id),
      createdAt: now,
      updatedAt: now
    })
    .returning()
    .get()

  // プロフィール情報を取得して結合 (Drizzleのjoinを使うことも可能)
  const profile = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parseInt(user.id)))
    .get()

  return {
    ...inserted,
    profiles: profile
  }
})
