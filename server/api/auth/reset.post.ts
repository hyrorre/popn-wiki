import { db } from '@nuxthub/db'
import { tokensTable, usersTable } from '../../db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { readZodBody } from '~/server/utils/validation'
import { getAccountPasswordValidationMessage, resetPasswordSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'auth:reset', limit: 5 })
  const { token, password } = await readZodBody(event, resetPasswordSchema)

  const tokenRecord = await db
    .select()
    .from(tokensTable)
    .where(and(eq(tokensTable.token, token), eq(tokensTable.type, 'reset'), gt(tokensTable.expiresAt, Date.now())))
    .get()
  if (!tokenRecord) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or expired token'
    })
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.id, tokenRecord.userId)).get()
  if (!user) {
    await db.delete(tokensTable).where(eq(tokensTable.id, tokenRecord.id))
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

  // Update user password
  await db
    .update(usersTable)
    .set({
      password: await hashPassword(password),
      confirmed: 1,
      updatedAt: new Date().toISOString()
    })
    .where(eq(usersTable.id, tokenRecord.userId))

  // Delete token after successful password change.
  await db.delete(tokensTable).where(eq(tokensTable.id, tokenRecord.id))

  return { message: 'Password has been reset successfully.' }
})
