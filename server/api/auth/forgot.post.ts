import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:forgot', limit: 3 })
  const { email } = await readBody(event)

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'Email is required'
    })
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  if (user) {
    const token = await generateToken(user.id, 'reset')
    await sendResetPasswordEmail(event, email, token)
  }

  // Always return success to prevent email enumeration
  return { message: 'If an account exists for this email, a reset link has been sent.' }
})
