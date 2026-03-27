import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { randomUUID } from 'node:crypto'
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
    id: randomUUID(),
    email,
    password: await hashPassword(password),
    name: name || email.split('@')[0],
    avatar: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.insert(usersTable).values(user)

  // Omit password from session
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...userWithoutPassword } = user
  
  await setUserSession(event, {
    user: userWithoutPassword
  })

  return userWithoutPassword
})
