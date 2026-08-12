import { expect, test, describe } from 'bun:test'
import { verifyPasswordMD5Crypt, verifyPasswordBcrypt } from '../server/utils/auth'

describe('Auth Utilities', () => {
  test('verifyPasswordMD5Crypt', () => {
    const password = 'focus123'
    const hash = '$1$erXgIjX7$fi/gmab/rku/qc6.ivndo0'

    expect(verifyPasswordMD5Crypt(hash, password)).toBe(true)
    expect(verifyPasswordMD5Crypt(hash, 'wrong-password')).toBe(false)
  })

  test('verifyPasswordBcrypt', () => {
    const password = 'test-password'
    const hash = '$2b$04$abcdefghijklmnopqrstuuobFaEJANklW4I6zZpcLRbXjrME4Qa2m'

    expect(verifyPasswordBcrypt(hash, password)).toBe(true)
    expect(verifyPasswordBcrypt(hash, 'wrong-password')).toBe(false)
  })
})
