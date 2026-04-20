import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { readZodBody } from '~/server/utils/validation'
import { emailOnlySchema } from '~/shared/zod'

const resendVerificationMessage = 'Verification email sent if account exists and is not verified.'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:resend', limit: 3 })
  const { email } = await readZodBody(event, emailOnlySchema)

  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  if (!user || user.confirmed === 1) {
    return { message: resendVerificationMessage }
  }

  // Generate new verification token and send email
  const token = await generateToken(user.id, 'verification')
  await sendVerificationEmail(event, email, token)

  return { message: resendVerificationMessage }
})
