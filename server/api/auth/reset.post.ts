import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { token, password } = await readBody(event)

  if (!token || !password) {
    throw createError({
      statusCode: 400,
      message: 'Token and new password are required'
    })
  }

  const tokenRecord = await verifyAndUseToken(token, 'reset')

  if (!tokenRecord) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired token'
    })
  }

  // Update user password
  await db
    .update(usersTable)
    .set({
      password: await hashPassword(password),
      confirmed: 1,
      updatedAt: new Date().toISOString()
    })
    .where(eq(usersTable.id, tokenRecord.userId))

  return { message: 'Password has been reset successfully.' }
})
