import { db } from '@nuxthub/db'
import { tokensTable } from '../db/schema'
import { eq, and, gt } from 'drizzle-orm'
import type { H3Event } from 'h3'

export const generateToken = async (userId: number, type: 'verification' | 'reset') => {
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 // 24 hours
  await db.insert(tokensTable).values({
    userId,
    token,
    type,
    expiresAt
  })
  return token
}

export const sendVerificationEmail = async (event: H3Event, email: string, token: string) => {
  const resend = useResend()
  const app = useAppConfig()
  const origin = getRequestURL(event).origin
  const url = `${origin}/verify?token=${token}`
  const from = process.env.NUXT_RESEND_FROM || 'onboarding@resend.dev'

  await resend.emails.send({
    from,
    to: email,
    subject: `【${app.title}】メールアドレスの確認`,
    html: `<p>ユーザー登録ありがとうございます。</p>
<p>以下のリンクをクリックして、メールアドレスの確認を完了してください：</p>
<p><a href="${url}">${url}</a></p>
<p>このメールに心当たりがない場合は、無視していただいて構いません。</p>`
  })
}

export const sendResetPasswordEmail = async (event: H3Event, email: string, token: string) => {
  const resend = useResend()
  const app = useAppConfig()
  const origin = getRequestURL(event).origin
  const url = `${origin}/reset?token=${token}`
  const from = process.env.NUXT_RESEND_FROM || 'onboarding@resend.dev'

  await resend.emails.send({
    from,
    to: email,
    subject: `【${app.title}】パスワードのリセット`,
    html: `<p>パスワード再設定のリクエストを受け付けました。</p>
<p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
<p><a href="${url}">${url}</a></p>
<p>このメールに心当たりがない場合は、第三者が誤ってメールアドレスを入力した可能性があります。その場合、パスワードが変更されることはありません。</p>`
  })
}

export const verifyAndUseToken = async (token: string, type: 'verification' | 'reset') => {
  const foundToken = await db
    .select()
    .from(tokensTable)
    .where(and(eq(tokensTable.token, token), eq(tokensTable.type, type), gt(tokensTable.expiresAt, Date.now())))
    .get()

  if (!foundToken) {
    return null
  }

  // Delete token after use
  await db.delete(tokensTable).where(eq(tokensTable.id, foundToken.id))

  return foundToken
}
