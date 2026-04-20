import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { readZodBody } from '~/server/utils/validation'
import { signupSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:signup', limit: 5 })
  const { email, password, name } = await readZodBody(event, signupSchema)

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

  // Generate verification token and send email
  // We need to fetch the inserted user to get the ID if we use auto-increment
  const insertedUser = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  if (insertedUser) {
    const token = await generateToken(insertedUser.id, 'verification')
    await sendVerificationEmail(event, email, token)
  }

  // Do NOT set session here, user must verify email first
  return { message: 'Registration successful. Please check your email to verify your account.' }
})
