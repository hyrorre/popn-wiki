import { expect, test, describe } from 'bun:test'
import { verifyPasswordMD5Crypt, verifyPasswordBcrypt } from '../server/utils/auth'

describe('Auth Utilities', () => {
  test('verifyPasswordMD5Crypt', async () => {
    const password = process.env.TEST_PASSWORD_MD5CRYPT!
    const hash = process.env.TEST_PASSWORDHASH_MD5CRYPT!
    expect(verifyPasswordMD5Crypt(hash, password)).toBe(true)
  })

  test('verifyPasswordBcrypt', async () => {
    const password = process.env.TEST_PASSWORD_BCRYPT!
    const hash = process.env.TEST_PASSWORDHASH_BCRYPT!
    const ok = verifyPasswordBcrypt(hash, password)
    expect(ok).toBe(true)
  })
})

// Since we can't easily run full Nitro environment tests here without more setup,
// we provide a template for the user to expand upon.
