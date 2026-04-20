import * as z from 'zod'

const hasControlCharacter = (value: string) => {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) {
      return true
    }
  }
  return false
}

export const emailSchema = z
  .email('有効なメールアドレスを入力してください')
  .trim()
  .toLowerCase()
  .max(255, 'メールアドレスは255文字以内で入力してください')

export const passwordSchema = z
  .string()
  .min(1, 'パスワードを入力してください')
  .max(128, 'パスワードは128文字以内で入力してください')

export const strongPasswordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .max(128, 'パスワードは128文字以内で入力してください')

export const userNameSchema = z
  .string()
  .trim()
  .min(1, '名前を入力してください')
  .max(80, '名前は80文字以内で入力してください')
  .refine((value) => !hasControlCharacter(value), '名前に制御文字は使用できません')

export const avatarSchema = z
  .string()
  .trim()
  .max(2048, 'アバターURLは2048文字以内で入力してください')
  .refine((value) => !hasControlCharacter(value), 'アバターURLに制御文字は使用できません')
  .nullable()
  .optional()

export const wikiPathSchema = z
  .string()
  .trim()
  .min(1, 'ページパスを入力してください')
  .max(512, 'ページパスは512文字以内で入力してください')
  .refine((value) => !hasControlCharacter(value), 'ページパスに制御文字は使用できません')
  .refine((value) => !value.includes('\\'), 'ページパスにバックスラッシュは使用できません')
  .refine((value) => !value.includes('//'), 'ページパスに連続したスラッシュは使用できません')
  .refine((value) => {
    if (value === '/') return true
    return !value.split('/').some((segment) => segment === '.' || segment === '..')
  }, 'ページパスに . または .. のみのセグメントは使用できません')

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'コメントを入力してください')
  .max(10000, 'コメントは10000文字以内で入力してください')

export const pageBodySchema = z
  .string()
  .max(1000000, '本文は1000000文字以内で入力してください')

export const pageMessageSchema = z
  .string()
  .trim()
  .max(200, '編集メッセージは200文字以内で入力してください')
  .optional()
  .transform((value) => value || undefined)

export const positiveIntSchema = z.number().int().positive()
export const nonNegativeIntSchema = z.number().int().min(0)
