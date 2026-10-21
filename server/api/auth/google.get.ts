import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { tokensTable, usersTable } from '../../db/schema'
import type { H3Event } from 'h3'
import { toSessionUser } from '~/server/utils/authorization'

interface GoogleUser {
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export default defineOAuthGoogleEventHandler({
  async onSuccess(event: H3Event, { user }: { user: GoogleUser }) {
    // google user object usually has: email, name, picture
    if (!user || !user.email) {
      return sendRedirect(event, '/signin?error=google_failed_no_email')
    }

    if (user.email_verified !== true) {
      return sendRedirect(event, '/signin?error=google_failed')
    }

    let existingUser = await db.select().from(usersTable).where(eq(usersTable.email, user.email)).get()

    if (!existingUser) {
      // ユーザーが存在しない場合は作成
      const now = new Date().toISOString()
      // OAuth経由のため、パスワードはセキュアなランダム文字列をハッシュ化して保存する
      const dummyPassword = await hashPassword(crypto.randomUUID())

      const newUsers = await db
        .insert(usersTable)
        .values({
          name: user.name || 'Google User',
          email: user.email,
          password: dummyPassword,
          avatar: user.picture || null,
          createdAt: now,
          updatedAt: now,
          confirmed: 1 // OAuth経由なのでメール認証済みとする
        })
        .returning()

      existingUser = newUsers[0]
      if (!existingUser) {
        throw createError({ statusCode: 500, message: 'ユーザーの作成に失敗しました' })
      }
    }

    if (existingUser.confirmed !== 1) {
      existingUser = await confirmPendingAccount(existingUser.id)
    }

    // セッションの設定
    await setUserSession(event, { user: toSessionUser(existingUser) })

    return sendRedirect(event, '/')
  },
  // errorハンドリング
  onError(event: H3Event, error: unknown) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/signin?error=google_failed')
  }
})

// 未確認アカウントのパスワードは、メールアドレスの所有者以外が登録した可能性がある。
// Google でメールアドレスの所有を確認できた時点で、既存の認証情報を引き継がずに無効化する。
async function confirmPendingAccount(userId: number) {
  const [confirmedUsers] = await db.batch([
    db
      .update(usersTable)
      .set({
        password: await hashPassword(crypto.randomUUID()),
        confirmed: 1,
        authVersion: sql`${usersTable.authVersion} + 1`,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(usersTable.id, userId), ne(usersTable.confirmed, 1)))
      .returning(),
    db.delete(tokensTable).where(eq(tokensTable.userId, userId))
  ])

  // 同時に確認済みになった場合は、二重に authVersion を進めず現在の行を使う。
  const user = confirmedUsers[0] ?? (await db.select().from(usersTable).where(eq(usersTable.id, userId)).get())
  if (!user) {
    throw createError({ statusCode: 500, message: 'ユーザーの確認に失敗しました' })
  }

  return user
}
