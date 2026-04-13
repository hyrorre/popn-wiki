import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { usersTable } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)

  if (!token || typeof token !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Missing or invalid token'
    })
  }

  const tokenRecord = await verifyAndUseToken(token, 'verification')

  if (!tokenRecord) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired token'
    })
  }

  // Update user confirmation status
  await db
    .update(usersTable)
    .set({ confirmed: 1, updatedAt: new Date().toISOString() })
    .where(eq(usersTable.id, tokenRecord.userId))

  return { message: 'Email verified successfully.' }
})
