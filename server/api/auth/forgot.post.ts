import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { readZodBody } from '~/server/utils/validation'
import { emailOnlySchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:forgot', limit: 3 })
  const { email } = await readZodBody(event, emailOnlySchema)

  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  if (user) {
    const token = await generateToken(user.id, 'reset')
    await sendResetPasswordEmail(email, token)
  }

  // Always return success to prevent email enumeration
  return { message: 'If an account exists for this email, a reset link has been sent.' }
})
