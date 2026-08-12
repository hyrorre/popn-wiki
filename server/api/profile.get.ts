import { db } from '@nuxthub/db'
import { usersTable } from '../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiUser } from '~/server/utils/authorization'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)
  const data = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).get()

  if (!data) {
    return { id: user.id, name: user.name, avatar: user.avatar }
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    avatar: data.avatar
  }
})
