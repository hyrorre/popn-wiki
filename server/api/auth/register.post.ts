import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { email, password, name } = await readBody(event)

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  // Check if user already exists
  const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()
  if (existingUser) {
    throw createError({
      statusCode: 400,
      message: 'User already exists'
    })
  }

  const user = {
    // id: auto increment
    email,
    password: await hashPassword(password),
    name: name || '',
    avatar: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.insert(usersTable).values(user)

  // Omit password from session

  const { password: _, ...userWithoutPassword } = user

  await setUserSession(event, {
    user: userWithoutPassword
  })

  return userWithoutPassword
})
