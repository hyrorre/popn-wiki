import { describe, expect, test } from 'bun:test'
import { getAccountPasswordValidationMessage, resetPasswordSchema, signupSchema } from '../shared/zod'

describe('Password schemas', () => {
  test('accepts long passphrases', () => {
    const result = signupSchema.safeParse({
      name: 'Popn User',
      email: 'user@example.com',
      password: 'correct horse battery staple'
    })

    expect(result.success).toBe(true)
  })

  test('accepts passwords with symbols when they are at least 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'token',
      password: 'short!23'
    })

    expect(result.success).toBe(true)
  })

  test('rejects passwords shorter than 15 characters without symbols', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'token',
      password: 'shortpassword'
    })

    expect(result.success).toBe(false)
  })

  test('rejects common passwords', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'token',
      password: 'passwordpassword'
    })

    expect(result.success).toBe(false)
  })

  test('rejects signup passwords containing the user name', () => {
    const result = signupSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'alice safe passphrase'
    })

    expect(result.success).toBe(false)
  })

  test('rejects signup passwords containing the email local part', () => {
    const result = signupSchema.safeParse({
      name: 'Wiki User',
      email: 'wikiuser@example.com',
      password: 'wikiuser safe passphrase'
    })

    expect(result.success).toBe(false)
  })

  test('rejects reset passwords containing account context', () => {
    expect(
      getAccountPasswordValidationMessage('alice safe passphrase', {
        name: 'Alice',
        email: 'alice@example.com'
      })
    ).toBe('パスワードにユーザー名を含めることはできません')
    expect(
      getAccountPasswordValidationMessage('wikiuser safe passphrase', {
        name: 'Wiki User',
        email: 'wikiuser@example.com'
      })
    ).toBe('パスワードにメールアドレスの一部を含めることはできません')
  })

  test('ignores very short names when checking password contents', () => {
    const result = signupSchema.safeParse({
      name: 'Aki',
      email: 'user@example.com',
      password: 'aki safe passphrase'
    })

    expect(result.success).toBe(true)
  })
})
