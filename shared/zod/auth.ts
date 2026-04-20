import * as z from 'zod'
import { emailSchema, passwordSchema, strongPasswordSchema, userNameSchema } from './common'

export const signinSchema = z.object({
  email: emailSchema,
  password: passwordSchema
})

export const signupSchema = z.object({
  name: userNameSchema,
  email: emailSchema,
  password: strongPasswordSchema
}).refine(({ name, password }) => !includesComparableValue(password, name), {
  path: ['password'],
  message: 'パスワードに名前を含めることはできません'
}).refine(({ email, password }) => {
  const localPart = email.split('@')[0] ?? ''
  return !includesComparableValue(password, localPart)
}, {
  path: ['password'],
  message: 'パスワードにメールアドレスの一部を含めることはできません'
})

export const emailOnlySchema = z.object({
  email: emailSchema
})

export const resetPasswordFormSchema = z.object({
  password: strongPasswordSchema
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'トークンが必要です').max(512, 'トークンが長すぎます'),
  password: strongPasswordSchema
})

export type SigninInput = z.output<typeof signinSchema>
export type SignupInput = z.output<typeof signupSchema>
export type EmailOnlyInput = z.output<typeof emailOnlySchema>
export type ResetPasswordFormInput = z.output<typeof resetPasswordFormSchema>
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>

function includesComparableValue(password: string, value: string) {
  const normalizedValue = normalizePasswordComparison(value)
  if (normalizedValue.length < 4) return false

  return normalizePasswordComparison(password).includes(normalizedValue)
}

function normalizePasswordComparison(value: string) {
  return value.trim().toLowerCase()
}
