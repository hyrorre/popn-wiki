import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { usersTable } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  if (!user || !(await verifyPassword(user.password, password))) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  if (user.confirmed !== 1) {
    throw createError({
      statusCode: 403,
      message: 'Email not verified. Please check your inbox.'
    })
  }

  const session = await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar
    }
  })

  return session.user
})
