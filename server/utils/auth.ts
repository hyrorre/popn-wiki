import { db } from '@nuxthub/db'
import { tokensTable } from '../db/schema'
import { eq, and, gt, lte } from 'drizzle-orm'
import cryptmd5 from 'cryptmd5'
import bcrypt from 'bcryptjs'

const TOKEN_EXPIRES_IN_HOURS = 24
const TOKEN_EXPIRES_IN_MS = 1000 * 60 * 60 * TOKEN_EXPIRES_IN_HOURS

export const generateToken = async (userId: number, type: 'verification' | 'reset') => {
  const now = Date.now()
  const token = crypto.randomUUID()
  const expiresAt = now + TOKEN_EXPIRES_IN_MS

  await db.delete(tokensTable).where(lte(tokensTable.expiresAt, now))
  await db.delete(tokensTable).where(and(eq(tokensTable.userId, userId), eq(tokensTable.type, type)))

  await db.insert(tokensTable).values({
    userId,
    token,
    type,
    expiresAt
  })
  return token
}

function getAuthActionUrl(path: '/verify' | '/reset', token: string) {
  const { app } = useAppConfig()
  const url = new URL(path, app.url)
  url.searchParams.set('token', token)
  return url.toString()
}

export const sendVerificationEmail = async (email: string, token: string) => {
  const resend = useResend()
  const { app } = useAppConfig()
  const url = getAuthActionUrl('/verify', token)
  const from = process.env.NUXT_RESEND_FROM || 'onboarding@resend.dev'

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `【${app.title}】メールアドレスの確認`,
    html: `<p>ユーザー登録ありがとうございます。</p>
<p>以下のリンクをクリックして、メールアドレスの確認を完了してください：</p>
<p><a href="${url}">${url}</a></p>
<p>このリンクの有効期限は${TOKEN_EXPIRES_IN_HOURS}時間です。</p>
<p>このメールに心当たりがない場合は、無視していただいて構いません。</p>`
  })

  if (error) {
    throw createError({ statusCode: 502, message: 'Failed to send verification email.' })
  }
}

export const sendResetPasswordEmail = async (email: string, token: string) => {
  const resend = useResend()
  const { app } = useAppConfig()
  const url = getAuthActionUrl('/reset', token)
  const from = process.env.NUXT_RESEND_FROM || 'onboarding@resend.dev'

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `【${app.title}】パスワードのリセット`,
    html: `<p>パスワード再設定のリクエストを受け付けました。</p>
<p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
<p><a href="${url}">${url}</a></p>
<p>このリンクの有効期限は${TOKEN_EXPIRES_IN_HOURS}時間です。</p>
<p>このメールに心当たりがない場合は、第三者が誤ってメールアドレスを入力した可能性があります。その場合、パスワードが変更されることはありません。</p>`
  })

  if (error) {
    throw createError({ statusCode: 502, message: 'Failed to send password reset email.' })
  }
}

export const findValidToken = async (token: string, type: 'verification' | 'reset') => {
  return db
    .select()
    .from(tokensTable)
    .where(and(eq(tokensTable.token, token), eq(tokensTable.type, type), gt(tokensTable.expiresAt, Date.now())))
    .get()
}

export const verifyAndUseToken = async (token: string, type: 'verification' | 'reset') => {
  return db
    .delete(tokensTable)
    .where(and(eq(tokensTable.token, token), eq(tokensTable.type, type), gt(tokensTable.expiresAt, Date.now())))
    .returning()
    .get()
}

export const verifyPasswordMD5Crypt = (hash: string, password: string) => {
  const salt = hash.match(/^\$1\$([^$]+)\$/)?.[1] // $1$xxxxxxxx$
  return salt && cryptmd5.cryptMD5(password, salt) === hash
}

export const verifyPasswordBcrypt = (hash: string, password: string) => {
  return bcrypt.compareSync(password, hash)
}
