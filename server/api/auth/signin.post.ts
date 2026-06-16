import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { readZodBody } from '~/server/utils/validation'
import { signinSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:signin', limit: 10 })
  const { email, password } = await readZodBody(event, signinSchema)

  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  const isScrypt = user?.password.startsWith('$scrypt$')
  const isValidPassword =
    user &&
    ((isScrypt && (await verifyPassword(user.password, password))) ||
      (user.password.startsWith('$2y$') && verifyPasswordBcrypt(user.password, password)) ||
      (user.password.startsWith('$1$') && verifyPasswordMD5Crypt(user.password, password)))

  if (!isValidPassword) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  if (!isScrypt) {
    const newPassword = await hashPassword(password)
    await db.update(usersTable).set({ password: newPassword }).where(eq(usersTable.id, user.id))
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
      avatar: user.avatar,
      role: user.role as 'user' | 'admin'
    }
  })

  return session.user
})
