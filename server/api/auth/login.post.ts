import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'

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

  // Omit password from session
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user

  await setUserSession(event, {
    user: userWithoutPassword
  })

  return userWithoutPassword
})
