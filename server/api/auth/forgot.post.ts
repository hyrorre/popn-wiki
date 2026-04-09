import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
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
