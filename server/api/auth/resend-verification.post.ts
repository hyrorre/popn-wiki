import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { usersTable } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'Email is required'
    })
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.email, email)).get()

  if (!user) {
    // セキュリティのため、ユーザーが存在しない場合も成功を返す（列挙攻撃対策）
    return { message: 'Verification email sent if account exists and is not verified.' }
  }

  if (user.confirmed === 1) {
    throw createError({
      statusCode: 400,
      message: 'Account is already verified.'
    })
  }

  // Generate new verification token and send email
  const token = await generateToken(user.id, 'verification')
  await sendVerificationEmail(event, email, token)

  return { message: 'Verification email has been resent. Please check your inbox.' }
})
