import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { findValidToken, verifyAndUseToken } from '~/server/utils/auth'
import { readZodBody } from '~/server/utils/validation'
import { getAccountPasswordValidationMessage, resetPasswordSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:reset', limit: 5 })
  const { token, password } = await readZodBody(event, resetPasswordSchema)

  const tokenRecord = await findValidToken(token, 'reset')
  if (!tokenRecord) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired token'
    })
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.id, tokenRecord.userId)).get()
  if (!user) {
    await verifyAndUseToken(token, 'reset')
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired token'
    })
  }

  const passwordValidationMessage = getAccountPasswordValidationMessage(password, {
    name: user.name,
    email: user.email
  })
  if (passwordValidationMessage) {
    throw createError({
      statusCode: 400,
      message: passwordValidationMessage
    })
  }

  const passwordHash = await hashPassword(password)
  const usedToken = await verifyAndUseToken(token, 'reset')
  if (!usedToken || usedToken.userId !== user.id) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired token'
    })
  }

  await db
    .update(usersTable)
    .set({
      password: passwordHash,
      authVersion: sql`${usersTable.authVersion} + 1`,
      confirmed: 1,
      updatedAt: new Date().toISOString()
    })
    .where(eq(usersTable.id, tokenRecord.userId))

  return { message: 'Password has been reset successfully.' }
})
