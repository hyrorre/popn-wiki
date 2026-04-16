import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { usersTable } from '../../db/schema'
import type { H3Event } from 'h3'

interface GoogleUser {
  email: string
  name?: string
  picture?: string
}

export default defineOAuthGoogleEventHandler({
  async onSuccess(event: H3Event, { user }: { user: GoogleUser }) {
    // google user object usually has: email, name, picture
    if (!user || !user.email) {
      return sendRedirect(event, '/signin?error=google_failed_no_email')
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

    // セッションの設定
    await setUserSession(event, {
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        avatar: existingUser.avatar
      }
    })

    return sendRedirect(event, '/')
  },
  // errorハンドリング
  onError(event: H3Event, error: unknown) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/signin?error=google_failed')
  }
})
