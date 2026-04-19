import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { checkRateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:signin', limit: 10 })
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  if (
    !user ||
    !(
      (user.password.startsWith('$scrypt$') && (await verifyPassword(user.password, password))) ||
      (user.password.startsWith('$2y$') && verifyPasswordBcrypt(user.password, password)) ||
      (user.password.startsWith('$1$') && verifyPasswordMD5Crypt(user.password, password))
    )
  ) {
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
