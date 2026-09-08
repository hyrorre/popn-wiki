import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type Client } from '@libsql/client'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'

type JsonRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

type PageResponse = {
  path: string
  title: string
  revision: number
  body: string
  bodyAst: string | null
  message: string | null
  minor: number | null
}

type CommentResponse = {
  id: number
  path: string
  body: string
  bodyAst: string | null
  userId: number
  replyTo: number | null
  profiles: { id: number; name: string; avatar?: string | null } | null
}

const rootDir = fileURLToPath(new URL('../..', import.meta.url))
const testDataDir = join(tmpdir(), `popn-wiki-api-test-${process.pid}`)
const databasePath = join(testDataDir, 'db', 'sqlite.db')
const emailCapturePath = join(testDataDir, 'resend.jsonl')
const resendMockPath = fileURLToPath(new URL('../fixtures/resend-mock.ts', import.meta.url))
const googleMockPath = fileURLToPath(new URL('../fixtures/google-mock.ts', import.meta.url))
const password = 'test-password'
const legacyBcryptHash = '$2y$04$abcdefghijklmnopqrstuuobFaEJANklW4I6zZpcLRbXjrME4Qa2m'

const users = {
  editor: { id: 101, name: 'Editor', email: 'editor@example.com', role: 'user' },
  other: { id: 102, name: 'Other', email: 'other@example.com', role: 'user' },
  admin: { id: 103, name: 'Admin', email: 'admin@example.com', role: 'admin' },
  unconfirmed: { id: 104, name: 'Pending', email: 'pending@example.com', role: 'user' },
  migration: { id: 105, name: 'Legacy', email: 'legacy@example.com', role: 'user' },
  deletable: { id: 106, name: 'Deletable', email: 'deletable@example.com', role: 'user' }
} as const

let database: Client
const sessions: Partial<Record<keyof typeof users, string>> = {}

rmSync(testDataDir, { recursive: true, force: true })

async function requestJson<T>(path: string, options: JsonRequestOptions = {}) {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  })
  const payload = (await response.json()) as T

  return { response, payload }
}

function withSession(session: keyof typeof users, headers: HeadersInit = {}) {
  const cookie = sessions[session]
  if (!cookie) {
    throw new Error(`Missing test session: ${session}`)
  }

  return { ...Object.fromEntries(new Headers(headers)), cookie }
}

async function login(session: keyof typeof users, ip: string, loginPassword = password) {
  const user = users[session]
  const { response, payload } = await requestJson<{ id?: number; statusCode?: number }>('/api/auth/signin', {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip },
    body: { email: user.email, password: loginPassword }
  })

  if (response.status !== 200) {
    throw new Error(`Failed to create ${session} session: ${response.status} ${JSON.stringify(payload)}`)
  }

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error(`Signin did not return a session cookie for ${session}`)
  }

  sessions[session] = setCookie.split(';', 1)[0]
  return payload
}

async function uploadImage(filename: string, data: Uint8Array, session?: keyof typeof users, ip = '203.0.113.60') {
  const formData = new FormData()
  const blobBytes = new Uint8Array(data.byteLength)
  blobBytes.set(data)
  formData.append('file', new Blob([blobBytes.buffer]), filename)
  const headers = session ? withSession(session, { 'cf-connecting-ip': ip }) : { 'cf-connecting-ip': ip }
  const response = await fetch('/api/image', { method: 'POST', headers, body: formData })
  const payload = (await response.json()) as { url?: string; filename?: string; message?: string }

  return { response, payload }
}

async function seedUsers() {
  await database.execute('DELETE FROM page_search_fts')
  await database.execute('DELETE FROM comments')
  await database.execute('DELETE FROM pages')
  await database.execute('DELETE FROM tokens')
  await database.execute('DELETE FROM users')

  const now = '2026-08-12T00:00:00.000Z'
  for (const [key, user] of Object.entries(users)) {
    await database.execute({
      sql: `
        INSERT INTO users (id, name, email, password, avatar, created_at, updated_at, confirmed, role)
        VALUES (?, ?, ?, ?, '', ?, ?, ?, ?)
      `,
      args: [user.id, user.name, user.email, legacyBcryptHash, now, now, key === 'unconfirmed' ? 0 : 1, user.role]
    })
  }
}

function capturedEmails() {
  if (!existsSync(emailCapturePath)) return []

  return readFileSync(emailCapturePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { url: string; payload: { to: string; subject: string; html: string } })
}

describe('API characterization', async () => {
  await setup({
    rootDir,
    dev: false,
    build: true,
    browser: false,
    setupTimeout: 120_000,
    nuxtConfig: {
      devtools: { enabled: false },
      fonts: {
        provider: 'local',
        providers: {
          adobe: false,
          bunny: false,
          fontshare: false,
          fontsource: false,
          google: false,
          googleicons: false,
          npm: false
        }
      },
      icon: {
        serverBundle: { collections: ['lucide'] },
        clientBundle: { sizeLimitKb: 0 }
      },
      nitro: {
        preset: 'node-server',
        plugins: [resendMockPath, googleMockPath]
      },
      hub: {
        dir: testDataDir,
        blob: { driver: 'fs', dir: join(testDataDir, 'blob') },
        cache: { driver: 'memory' },
        kv: { driver: 'memory' },
        db: {
          dialect: 'sqlite',
          driver: 'libsql',
          connection: { url: `file:${databasePath}` },
          applyMigrationsDuringDev: false,
          applyMigrationsDuringBuild: true
        }
      }
    },
    env: {
      NODE_ENV: 'test',
      NUXT_SESSION_PASSWORD: 'test-session-password-with-at-least-thirty-two-characters',
      NUXT_RESEND_API_KEY: 're_test_api_key',
      NUXT_RESEND_FROM: 'test@example.com',
      NUXT_OAUTH_GOOGLE_CLIENT_ID: 'test-client',
      NUXT_OAUTH_GOOGLE_CLIENT_SECRET: 'test-secret',
      NUXT_TEST_EMAIL_CAPTURE_PATH: emailCapturePath,
      NUXT_CLOUDFLARE_ZONE_ID: '',
      NUXT_CLOUDFLARE_CACHE_PURGE_TOKEN: ''
    }
  })
  const testContext = useTestContext()
  testContext.teardown = [...(testContext.teardown ?? []), () => rmSync(testDataDir, { recursive: true, force: true })]

  beforeAll(async () => {
    database = createClient({ url: `file:${databasePath}` })
    await seedUsers()
    await login('editor', '203.0.113.11')
    await login('other', '203.0.113.12')
    await login('admin', '203.0.113.13')
    await login('deletable', '203.0.113.14')
  })

  afterAll(() => {
    database.close()
  })

  describe.sequential('authentication contracts', () => {
    test('Google login confirms an existing pending account and survives session refresh', async () => {
      const now = new Date().toISOString()
      await database.execute({
        sql: `INSERT INTO users (name, email, password, created_at, updated_at, confirmed)
              VALUES (?, ?, ?, ?, ?, 0)`,
        args: ['Google pending', 'google-pending@example.com', legacyBcryptHash, now, now]
      })
      const response = await fetch('/api/auth/google?code=verified', { redirect: 'manual' })
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/')
      const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
      expect(cookie).toBeTruthy()
      const refreshed = await requestJson<{ user?: { email: string } }>('/api/_auth/session', {
        headers: { cookie: cookie! }
      })
      expect(refreshed.payload.user?.email).toBe('google-pending@example.com')
      const record = await database.execute("SELECT confirmed FROM users WHERE email = 'google-pending@example.com'")
      expect(record.rows[0]?.confirmed).toBe(1)
    })

    test('Google login rejects unverified or missing email verification claims', async () => {
      for (const code of ['unverified', 'missing']) {
        const response = await fetch(`/api/auth/google?code=${code}`, { redirect: 'manual' })
        expect(response.headers.get('location')).toBe('/signin?error=google_failed')
        expect(response.headers.get('set-cookie')).toBeNull()
      }
      const record = await database.execute("SELECT id FROM users WHERE email = 'google-unverified@example.com'")
      expect(record.rows).toHaveLength(0)
    })

    test('rejects invalid credentials without disclosing which field was wrong', async () => {
      const { response, payload } = await requestJson<{ message: string }>('/api/auth/signin', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.20' },
        body: { email: users.editor.email, password: 'wrong-password' }
      })

      expect(response.status).toBe(401)
      expect(payload.message).toBe('Invalid email or password')
    })

    test('rejects an unconfirmed account', async () => {
      const { response, payload } = await requestJson<{ message: string }>('/api/auth/signin', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.21' },
        body: { email: users.unconfirmed.email, password }
      })

      expect(response.status).toBe(403)
      expect(payload.message).toBe('Email not verified. Please check your inbox.')
    })

    test('migrates a legacy bcrypt hash after successful signin', async () => {
      await login('migration', '203.0.113.22')

      const result = await database.execute({
        sql: 'SELECT password FROM users WHERE id = ?',
        args: [users.migration.id]
      })

      expect(String(result.rows[0]?.password)).toMatch(/^\$scrypt\$/)
    })

    test('verification tokens are valid only once even for concurrent requests', async () => {
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.unconfirmed.id, 'verify-once', 'verification', Date.now() + 60_000]
      })

      const results = await Promise.all([
        requestJson<{ message: string }>('/api/auth/verify?token=verify-once'),
        requestJson<{ message: string }>('/api/auth/verify?token=verify-once')
      ])
      const [success] = results.filter(({ response }) => response.status === 200)
      const [rejected] = results.filter(({ response }) => response.status === 400)

      expect(results.map(({ response }) => response.status).sort()).toEqual([200, 400])
      expect(success?.payload.message).toBe('Email verified successfully.')
      expect(rejected?.payload.message).toBe('Invalid or expired token')
    })

    test('a password reset confirms the account and is atomic for concurrent requests', async () => {
      await database.execute({
        sql: 'UPDATE users SET confirmed = 0 WHERE id = ?',
        args: [users.unconfirmed.id]
      })
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.unconfirmed.id, 'reset-once', 'reset', Date.now() + 60_000]
      })

      const results = await Promise.all([
        requestJson<{ message: string }>('/api/auth/reset', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.23' },
          body: { token: 'reset-once', password: 'brand-new-password!' }
        }),
        requestJson<{ message: string }>('/api/auth/reset', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.25' },
          body: { token: 'reset-once', password: 'brand-new-password!' }
        })
      ])
      const userResult = await database.execute({
        sql: 'SELECT confirmed, password FROM users WHERE id = ?',
        args: [users.unconfirmed.id]
      })
      const tokenResult = await database.execute({
        sql: 'SELECT count(*) AS count FROM tokens WHERE token = ?',
        args: ['reset-once']
      })

      const [success] = results.filter(({ response }) => response.status === 200)
      const [rejected] = results.filter(({ response }) => response.status === 400)

      expect(results.map(({ response }) => response.status).sort()).toEqual([200, 400])
      expect(success?.payload.message).toBe('Password has been reset successfully.')
      expect(rejected?.payload.message).toBe('Invalid or expired token')
      expect(Number(userResult.rows[0]?.confirmed)).toBe(1)
      expect(String(userResult.rows[0]?.password)).toMatch(/^\$scrypt\$/)
      expect(Number(tokenResult.rows[0]?.count)).toBe(0)
    })

    test('rate limits repeated signin attempts per client IP', async () => {
      let lastStatus = 0
      for (let index = 0; index < 11; index += 1) {
        const { response } = await requestJson('/api/auth/signin', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.99' },
          body: { email: 'nobody@example.com', password: 'wrong-password' }
        })
        lastStatus = response.status
      }

      expect(lastStatus).toBe(429)
    })

    test('signout clears the client session cookie', async () => {
      const signedOut = await requestJson<{ message: string }>('/api/auth/signout', {
        method: 'POST',
        headers: withSession('migration')
      })
      const setCookie = signedOut.response.headers.get('set-cookie')
      const clearedCookie = setCookie?.split(';', 1)[0]

      expect(signedOut.response.status).toBe(200)
      expect(signedOut.payload).toEqual({ message: 'Signed out' })
      expect(clearedCookie).toBeTruthy()

      const profile = await requestJson('/api/profile', {
        headers: { cookie: clearedCookie ?? '' }
      })
      expect(profile.response.status).toBe(401)
    })

    test('rejects an existing session when the account is no longer confirmed', async () => {
      const staleCookie = sessions.editor
      if (!staleCookie) {
        throw new Error('Missing editor session')
      }

      await database.execute({
        sql: 'UPDATE users SET confirmed = 0 WHERE id = ?',
        args: [users.editor.id]
      })

      try {
        const profile = await requestJson('/api/profile', {
          headers: { cookie: staleCookie }
        })
        const session = await requestJson<Record<string, unknown>>('/api/_auth/session', {
          headers: { cookie: staleCookie }
        })

        expect(profile.response.status).toBe(401)
        expect(profile.response.headers.get('set-cookie')).toBeTruthy()
        expect(session.response.status).toBe(200)
        expect(session.payload).not.toHaveProperty('user')
        expect(session.response.headers.get('set-cookie')).toBeTruthy()
      } finally {
        await database.execute({
          sql: 'UPDATE users SET confirmed = 1 WHERE id = ?',
          args: [users.editor.id]
        })
      }
    })

    test('uses the current database role instead of stale administrator claims', async () => {
      const staleCookie = sessions.admin
      if (!staleCookie) {
        throw new Error('Missing admin session')
      }

      await database.execute({
        sql: "UPDATE users SET role = 'user' WHERE id = ?",
        args: [users.admin.id]
      })

      try {
        const adminRequest = await requestJson('/api/admin/backfill-comment-ast', {
          method: 'POST',
          headers: { cookie: staleCookie },
          body: { limit: 1 }
        })
        const session = await requestJson<{ user?: { role?: string } }>('/api/_auth/session', {
          headers: { cookie: staleCookie }
        })

        expect(adminRequest.response.status).toBe(403)
        expect(adminRequest.response.headers.get('set-cookie')).toBeTruthy()
        expect(session.response.status).toBe(200)
        expect(session.payload.user?.role).toBe('user')
        expect(session.response.headers.get('set-cookie')).toBeTruthy()
      } finally {
        await database.execute({
          sql: "UPDATE users SET role = 'admin' WHERE id = ?",
          args: [users.admin.id]
        })
        await login('admin', '203.0.113.24')
      }
    })
  })

  describe.sequential('registration and email delivery contracts', () => {
    const signupEmail = 'new-account@example.com'

    test('signup creates an unconfirmed account and sends a verification link without a session', async () => {
      const beforeEmails = capturedEmails().length
      const signup = await requestJson<{ message: string }>('/api/auth/signup', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '203.0.113.50',
          'x-forwarded-host': 'attacker.example',
          'x-forwarded-proto': 'http'
        },
        body: { name: 'New Account', email: signupEmail, password: 'safe-passphrase!' }
      })
      const user = await database.execute({
        sql: 'SELECT id, confirmed, password FROM users WHERE email = ?',
        args: [signupEmail]
      })
      const tokens = await database.execute({
        sql: 'SELECT token, type FROM tokens WHERE user_id = ?',
        args: [Number(user.rows[0]?.id)]
      })
      const emails = capturedEmails()

      expect(signup.response.status).toBe(200)
      expect(signup.response.headers.get('set-cookie')).toBeNull()
      expect(user.rows[0]).toMatchObject({ confirmed: 0 })
      expect(String(user.rows[0]?.password)).toMatch(/^\$scrypt\$/)
      expect(tokens.rows).toHaveLength(1)
      expect(tokens.rows[0]?.type).toBe('verification')
      expect(emails).toHaveLength(beforeEmails + 1)
      expect(emails.at(-1)?.payload).toMatchObject({
        to: signupEmail,
        subject: expect.stringContaining('メールアドレスの確認')
      })
      expect(emails.at(-1)?.payload.html).toContain(
        `https://popn.wiki/verify?token=${String(tokens.rows[0]?.token)}`
      )
      expect(emails.at(-1)?.payload.html).not.toContain('attacker.example')
    })

    test('duplicate signup does not create another token or send another email', async () => {
      const beforeEmails = capturedEmails().length
      const beforeTokens = await database.execute({
        sql: 'SELECT count(*) AS count FROM tokens JOIN users ON tokens.user_id = users.id WHERE users.email = ?',
        args: [signupEmail]
      })
      const duplicate = await requestJson<{ message: string }>('/api/auth/signup', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.50' },
        body: { name: 'Duplicate', email: signupEmail, password: 'another-passphrase!' }
      })
      const afterTokens = await database.execute({
        sql: 'SELECT count(*) AS count FROM tokens JOIN users ON tokens.user_id = users.id WHERE users.email = ?',
        args: [signupEmail]
      })

      expect(duplicate.response.status).toBe(400)
      expect(duplicate.payload.message).toBe('User already exists')
      expect(Number(afterTokens.rows[0]?.count)).toBe(Number(beforeTokens.rows[0]?.count))
      expect(capturedEmails()).toHaveLength(beforeEmails)
    })

    test('resending verification replaces the old token', async () => {
      await database.execute({
        sql: 'UPDATE users SET confirmed = 0 WHERE id = ?',
        args: [users.unconfirmed.id]
      })
      await database.execute({
        sql: 'DELETE FROM tokens WHERE user_id = ? AND type = ?',
        args: [users.unconfirmed.id, 'verification']
      })
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.unconfirmed.id, 'superseded-verification', 'verification', Date.now() + 60_000]
      })
      const beforeEmails = capturedEmails().length

      const resent = await requestJson<{ message: string }>('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.51' },
        body: { email: users.unconfirmed.email }
      })
      const tokens = await database.execute({
        sql: 'SELECT token FROM tokens WHERE user_id = ? AND type = ?',
        args: [users.unconfirmed.id, 'verification']
      })
      const oldToken = await requestJson<{ message: string }>('/api/auth/verify?token=superseded-verification')

      expect(resent.response.status).toBe(200)
      expect(tokens.rows).toHaveLength(1)
      expect(tokens.rows[0]?.token).not.toBe('superseded-verification')
      expect(oldToken.response.status).toBe(400)
      expect(capturedEmails()).toHaveLength(beforeEmails + 1)
    })

    test('forgot password has the same response for existing and unknown emails', async () => {
      const beforeEmails = capturedEmails().length
      const existing = await requestJson<{ message: string }>('/api/auth/forgot', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '203.0.113.52',
          'x-forwarded-host': 'attacker.example',
          'x-forwarded-proto': 'http'
        },
        body: { email: ` ${users.other.email.toUpperCase()} ` }
      })
      const unknown = await requestJson<{ message: string }>('/api/auth/forgot', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.53' },
        body: { email: 'unknown-account@example.com' }
      })
      const resetTokens = await database.execute({
        sql: 'SELECT token FROM tokens WHERE user_id = ? AND type = ?',
        args: [users.other.id, 'reset']
      })
      const emails = capturedEmails()

      expect(existing.response.status).toBe(200)
      expect(unknown.response.status).toBe(200)
      expect(existing.payload).toEqual(unknown.payload)
      expect(resetTokens.rows).toHaveLength(1)
      expect(emails).toHaveLength(beforeEmails + 1)
      expect(emails.at(-1)?.payload.to).toBe(users.other.email)
      expect(emails.at(-1)?.payload.html).toContain(
        `https://popn.wiki/reset?token=${String(resetTokens.rows[0]?.token)}`
      )
      expect(emails.at(-1)?.payload.html).not.toContain('attacker.example')
    })

    test('forgot password rejects malformed email payloads before lookup', async () => {
      const beforeEmails = capturedEmails().length
      const malformed = await requestJson<{ message: string }>('/api/auth/forgot', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.58' },
        body: { email: 'not-an-email' }
      })

      expect(malformed.response.status).toBe(400)
      expect(malformed.payload.message).toBe('Invalid payload.')
      expect(capturedEmails()).toHaveLength(beforeEmails)
    })

    test('expired verification and reset tokens are rejected', async () => {
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.editor.id, 'expired-verification', 'verification', Date.now() - 1]
      })
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.editor.id, 'expired-reset', 'reset', Date.now() - 1]
      })

      const verification = await requestJson<{ message: string }>('/api/auth/verify?token=expired-verification')
      const reset = await requestJson<{ message: string }>('/api/auth/reset', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.54' },
        body: { token: 'expired-reset', password: 'expired-token-pass!' }
      })

      expect(verification.response.status).toBe(400)
      expect(verification.payload.message).toBe('Invalid or expired token')
      expect(reset.response.status).toBe(400)
      expect(reset.payload.message).toBe('Invalid or expired token')
    })

    test('signup reports delivery failure while preserving an account that can retry verification', async () => {
      const failureEmail = 'delivery-failure@example.com'
      const failed = await requestJson<{ message: string }>('/api/auth/signup', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.55' },
        body: { name: 'Delivery Failure', email: failureEmail, password: 'retry-later-pass!' }
      })
      const stored = await database.execute({
        sql: `
          SELECT users.confirmed, count(tokens.id) AS tokens
          FROM users
          LEFT JOIN tokens ON tokens.user_id = users.id
          WHERE users.email = ?
          GROUP BY users.id
        `,
        args: [failureEmail]
      })

      expect(failed.response.status).toBe(502)
      expect(failed.payload.message).toBe('Failed to send verification email.')
      expect(stored.rows[0]).toMatchObject({ confirmed: 0, tokens: 1 })
    })
  })

  describe.sequential('profile privacy and update contracts', () => {
    test('requires authentication to read or update a profile', async () => {
      const read = await requestJson('/api/profile')
      const update = await requestJson('/api/profile', {
        method: 'POST',
        body: { name: 'Anonymous', avatar: null }
      })

      expect(read.response.status).toBe(401)
      expect(update.response.status).toBe(401)
    })

    test('returns only public account fields after an update', async () => {
      const avatar = 'https://example.com/avatar.png'
      const updated = await requestJson<Record<string, unknown>>('/api/profile', {
        method: 'POST',
        headers: withSession('migration'),
        body: { name: 'Legacy Updated', avatar }
      })

      expect(updated.response.status).toBe(200)
      expect(updated.payload).toEqual({
        id: users.migration.id,
        name: 'Legacy Updated',
        email: users.migration.email,
        avatar
      })
      expect(updated.payload).not.toHaveProperty('password')
      expect(updated.payload).not.toHaveProperty('confirmed')
      expect(updated.payload).not.toHaveProperty('role')

      const setCookie = updated.response.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      const refreshedCookie = setCookie?.split(';', 1)[0]
      const session = await requestJson<{ user?: { name?: string; avatar?: string | null } }>('/api/_auth/session', {
        headers: { cookie: refreshedCookie ?? '' }
      })
      expect(session.payload.user).toMatchObject({ name: 'Legacy Updated', avatar })
    })

    test('reads the updated avatar from the database instead of the stale session', async () => {
      const profile = await requestJson<Record<string, unknown>>('/api/profile', {
        headers: withSession('migration')
      })

      expect(profile.payload).toEqual({
        id: users.migration.id,
        name: 'Legacy Updated',
        email: users.migration.email,
        avatar: 'https://example.com/avatar.png'
      })
      expect(profile.payload).not.toHaveProperty('password')
    })

    test('rejects invalid profile payloads without changing stored data', async () => {
      const invalid = await requestJson('/api/profile', {
        method: 'POST',
        headers: withSession('migration'),
        body: { name: '', avatar: null }
      })
      const stored = await database.execute({
        sql: 'SELECT name, avatar FROM users WHERE id = ?',
        args: [users.migration.id]
      })

      expect(invalid.response.status).toBe(400)
      expect(stored.rows[0]).toMatchObject({
        name: 'Legacy Updated',
        avatar: 'https://example.com/avatar.png'
      })
    })
  })

  describe.sequential('account deletion contracts', () => {
    const path = 'characterization/deleted-account'

    test('requires authentication without changing any account', async () => {
      const before = await database.execute('SELECT count(*) AS count FROM users')
      const deleted = await requestJson('/api/user/delete', { method: 'POST' })
      const after = await database.execute('SELECT count(*) AS count FROM users')

      expect(deleted.response.status).toBe(401)
      expect(Number(after.rows[0]?.count)).toBe(Number(before.rows[0]?.count))
    })

    test('removes only the account and its tokens while preserving authored content', async () => {
      const staleCookie = sessions.deletable
      if (!staleCookie) {
        throw new Error('Missing deletable session')
      }

      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('deletable'),
        body: { path, body: '# Deleted account page', baseRevision: 0 }
      })
      const comment = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('deletable', { 'cf-connecting-ip': '203.0.113.45' }),
        body: { path, body: 'comment by a deleted account' }
      })
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.deletable.id, 'deletable-token', 'reset', Date.now() + 60_000]
      })

      const commentListUrl = `/api/comment?path=${encodeURIComponent(path)}&page=1&limit=11`
      const recentUrl = '/api/comment/recent?limit=17&page=1'
      const primedList = await requestJson<{ comments: CommentResponse[]; total: number }>(commentListUrl)
      const primedRecent = await requestJson<{
        data: Array<{ path: string; commenter: string }>
        total: number
      }>(recentUrl)
      const deleted = await requestJson<{ message: string }>('/api/user/delete', {
        method: 'POST',
        headers: withSession('deletable')
      })
      const afterList = await requestJson<{ comments: CommentResponse[]; total: number }>(commentListUrl)
      const afterRecent = await requestJson<{
        data: Array<{ path: string; commenter: string }>
        total: number
      }>(recentUrl)

      const stored = await database.execute({
        sql: `
          SELECT
            (SELECT count(*) FROM users WHERE id = ?) AS users,
            (SELECT count(*) FROM users WHERE id = ?) AS other_users,
            (SELECT count(*) FROM tokens WHERE user_id = ?) AS tokens,
            (SELECT count(*) FROM pages WHERE path = ?) AS pages,
            (SELECT count(*) FROM comments WHERE id = ?) AS comments
        `,
        args: [users.deletable.id, users.other.id, users.deletable.id, path, comment.payload.id]
      })

      expect(primedList.payload.comments[0]?.profiles).toMatchObject({ name: users.deletable.name })
      expect(primedRecent.payload.data).toContainEqual(
        expect.objectContaining({ path, commenter: users.deletable.name })
      )
      expect(deleted.response.status).toBe(200)
      expect(deleted.payload).toEqual({ message: 'User deleted.' })
      expect(stored.rows[0]).toMatchObject({ users: 0, other_users: 1, tokens: 0, pages: 1, comments: 1 })
      expect(afterList.payload.comments[0]).toMatchObject({ id: comment.payload.id, profiles: null })
      expect(afterRecent.payload.data).toContainEqual(expect.objectContaining({ path, commenter: '匿名' }))

      const setCookie = deleted.response.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      const clearedCookie = setCookie?.split(';', 1)[0]
      if (!clearedCookie) {
        throw new Error('Account deletion did not clear the session cookie')
      }
      const afterClearedSession = await requestJson('/api/profile', {
        headers: { cookie: clearedCookie }
      })
      expect(afterClearedSession.response.status).toBe(401)

      const staleProfile = await requestJson('/api/profile', {
        headers: { cookie: staleCookie }
      })
      const staleSession = await requestJson<Record<string, unknown>>('/api/_auth/session', {
        headers: { cookie: staleCookie }
      })
      expect(staleProfile.response.status).toBe(401)
      expect(staleProfile.response.headers.get('set-cookie')).toBeTruthy()
      expect(staleSession.response.status).toBe(200)
      expect(staleSession.payload).not.toHaveProperty('user')
      expect(staleSession.response.headers.get('set-cookie')).toBeTruthy()
    })
  })

  describe.sequential('image API contracts', () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    const gifBytes = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00])

    test('requires authentication for multipart uploads', async () => {
      const uploaded = await uploadImage('anonymous.png', pngBytes)

      expect(uploaded.response.status).toBe(401)
      expect(uploaded.payload.message).toBe('Unauthorized.')
    })

    test('uploads a valid image with its original filename', async () => {
      const uploaded = await uploadImage('integration.png', pngBytes, 'editor', '203.0.113.61')

      expect(uploaded.response.status).toBe(200)
      expect(uploaded.payload).toEqual({ url: 'integration.png', filename: 'integration.png' })
    })

    test('rejects mismatched content, oversized files, and duplicate names', async () => {
      const mismatch = await uploadImage('mismatch.jpg', pngBytes, 'editor', '203.0.113.62')
      const oversized = await uploadImage(
        'oversized.png',
        new Uint8Array(5 * 1024 * 1024 + 1),
        'editor',
        '203.0.113.63'
      )
      const duplicate = await uploadImage('integration.png', pngBytes, 'editor', '203.0.113.64')

      expect(mismatch.response.status).toBe(400)
      expect(mismatch.payload.message).toBe('拡張子とファイル内容が一致しません。')
      expect(oversized.response.status).toBe(400)
      expect(oversized.payload.message).toBe('ファイルサイズは5MB以下にしてください。')
      expect(duplicate.response.status).toBe(409)
      expect(duplicate.payload.message).toContain('同名のファイルが既に存在します')
    })

    test('serves encoded filenames using the canonical name and rejects aliases', async () => {
      const uploaded = await uploadImage('encoded%20chart.png', pngBytes, 'editor', '203.0.113.80')
      expect(uploaded.response.status).toBe(200)
      expect(uploaded.payload.url).toBe('encoded chart.png')
      const served = await fetch(`/api/image/${encodeURIComponent(uploaded.payload.url!)}`)
      expect(served.status).toBe(200)
      expect(new Uint8Array(await served.arrayBuffer())).toEqual(pngBytes)
      const duplicate = await uploadImage('encoded chart.png', pngBytes, 'editor', '203.0.113.81')
      expect(duplicate.response.status).toBe(409)
    })

    test('allows only one of two concurrent uploads with the same filename', async () => {
      const results = await Promise.all([
        uploadImage('concurrent.png', pngBytes, 'editor', '203.0.113.66'),
        uploadImage('concurrent.png', pngBytes, 'other', '203.0.113.67')
      ])

      expect(results.map(({ response }) => response.status).sort()).toEqual([200, 409])
      expect(results.find(({ response }) => response.status === 409)?.payload.message).toContain(
        '同名のファイルが既に存在します'
      )
    })

    test('lists images with cursor pagination and public URLs', async () => {
      const second = await uploadImage('second.gif', gifBytes, 'other', '203.0.113.65')
      expect(second.response.status).toBe(200)

      const firstPage = await requestJson<{
        images: Array<{ name: string; url: string; created_at: string }>
        cursor?: string
        hasMore: boolean
      }>('/api/image?limit=2')
      const secondPage = await requestJson<{
        images: Array<{ name: string; url: string; created_at: string }>
        hasMore: boolean
      }>(`/api/image?limit=2&cursor=${encodeURIComponent(firstPage.payload.cursor ?? '')}`)
      const images = [...firstPage.payload.images, ...secondPage.payload.images]

      expect(firstPage.response.status).toBe(200)
      expect(firstPage.payload.hasMore).toBe(true)
      expect(firstPage.payload.cursor).toBeTruthy()
      expect(images).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'integration.png', url: '/api/image/integration.png' }),
          expect.objectContaining({ name: 'second.gif', url: '/api/image/second.gif' })
        ])
      )
    })

    test('redirects supported legacy image URLs while preserving filenames and queries', async () => {
      for (const prefix of ['/score/start/', '/_media/score/start/']) {
        for (const filename of [
          'integration.png',
          'second.gif',
          'photo.jpg',
          'photo.jpeg',
          'photo.webp',
          '日本語.GIF'
        ]) {
          const encodedFilename = encodeURIComponent(filename)
          const response = await fetch(`${prefix}${encodedFilename}?download=1`, { redirect: 'manual' })

          expect(response.status).toBe(301)
          expect(response.headers.get('location')).toBe(`/api/image/${encodedFilename}?download=1`)
        }
      }
    })

    test('does not redirect unrelated paths or unsupported legacy image extensions', async () => {
      for (const path of [
        '/score/second.gif',
        '/score/start/file.svg',
        '/_media/score/start/file.txt',
        '/score/start/second.gif/'
      ]) {
        const response = await fetch(path, { redirect: 'manual' })

        expect(response.headers.get('location')).toBeNull()
        expect(response.status).not.toBe(301)
      }
    })

    test('serves GIF bytes unchanged through both legacy image URLs', async () => {
      for (const path of ['/api/image/second.gif', '/score/start/second.gif', '/_media/score/start/second.gif']) {
        const response = await fetch(path)

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/gif')
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(gifBytes)
      }
    })

    test('serves image bytes with content type and immutable browser caching', async () => {
      const response = await fetch('/api/image/integration.png')
      const bytes = new Uint8Array(await response.arrayBuffer())

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('cache-control')).toBe('public, max-age=2592000, immutable')
      expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=2592000, immutable')
      expect(bytes).toEqual(pngBytes)
    })
  })

  describe.sequential('admin API contracts', () => {
    const endpoints: Array<{ path: string; options?: JsonRequestOptions }> = [
      { path: '/api/admin/backfill-comment-ast', options: { method: 'POST', body: {} } },
      { path: '/api/admin/rebuild-page-search-fts', options: { method: 'POST', body: {} } },
      { path: '/api/admin/broken-links' }
    ]

    test('requires an administrator for every admin endpoint', async () => {
      for (const endpoint of endpoints) {
        const anonymous = await requestJson(endpoint.path, endpoint.options)
        const ordinaryUser = await requestJson(endpoint.path, {
          ...endpoint.options,
          headers: withSession('editor')
        })

        expect(anonymous.response.status).toBe(401)
        expect(ordinaryUser.response.status).toBe(403)
      }
    })

    test('backfills missing comment ASTs once and is idempotent', async () => {
      const path = 'characterization/admin-backfill'
      const now = new Date().toISOString()
      await database.execute({
        sql: `
          INSERT INTO comments (path, body, body_ast, reply_to, user_id, created_at, updated_at, deleted_at)
          VALUES (?, ?, NULL, NULL, ?, ?, ?, NULL)
        `,
        args: [path, '**backfill me**', users.editor.id, now, now]
      })

      const first = await requestJson<{
        scanned: number
        updated: number
        failed: unknown[]
        touchedPaths: string[]
      }>('/api/admin/backfill-comment-ast', {
        method: 'POST',
        headers: withSession('admin'),
        body: { limit: 9999, path: ` ${path} ` }
      })
      const second = await requestJson<{ scanned: number; updated: number }>('/api/admin/backfill-comment-ast', {
        method: 'POST',
        headers: withSession('admin'),
        body: { limit: 9999, path }
      })
      const stored = await database.execute({
        sql: 'SELECT body_ast FROM comments WHERE path = ?',
        args: [path]
      })

      expect(first.response.status).toBe(200)
      expect(first.payload).toEqual({ scanned: 1, updated: 1, failed: [], touchedPaths: [path] })
      expect(second.payload).toMatchObject({ scanned: 0, updated: 0 })
      expect(JSON.parse(String(stored.rows[0]?.body_ast))).toHaveProperty('body')
    })

    test('rebuilds the search index repeatedly without duplicate rows', async () => {
      const first = await requestJson<{
        scanned: number
        indexed: number
        done: boolean
        reset: boolean
      }>('/api/admin/rebuild-page-search-fts', {
        method: 'POST',
        headers: withSession('admin'),
        body: { limit: 9999, reset: true }
      })
      const firstRows = await database.execute('SELECT count(*) AS count FROM page_search_fts')
      const second = await requestJson<{
        scanned: number
        indexed: number
        done: boolean
        reset: boolean
      }>('/api/admin/rebuild-page-search-fts', {
        method: 'POST',
        headers: withSession('admin'),
        body: { limit: 9999, reset: true }
      })
      const secondRows = await database.execute('SELECT count(*) AS count FROM page_search_fts')

      expect(first.response.status).toBe(200)
      expect(first.payload).toMatchObject({ done: true, reset: true })
      expect(first.payload.indexed).toBeGreaterThan(0)
      expect(second.payload).toEqual(first.payload)
      expect(Number(secondRows.rows[0]?.count)).toBe(Number(firstRows.rows[0]?.count))
    })

    test('rolls back a page revision when its search index update fails', async () => {
      const path = 'characterization/atomic-page-index'
      for (const suffix of ['a', 'b']) {
        await requestJson<PageResponse>('/api/page', {
          method: 'PUT',
          headers: withSession('editor'),
          body: {
            path: `${path}-${suffix}`,
            body: `# Fallback ${suffix}\nbounded fallback term`,
            baseRevision: 0
          }
        })
      }
      await database.execute('DROP TABLE page_search_fts')

      let failedWrite: Awaited<ReturnType<typeof requestJson>>
      let stored: Awaited<ReturnType<Client['execute']>>

      try {
        const fallbackSearch = await requestJson<{ total: number; items: unknown[] }>(
          '/api/search?q=bounded%20fallback&limit=1'
        )
        failedWrite = await requestJson('/api/page', {
          method: 'PUT',
          headers: withSession('editor'),
          body: { path, body: '# Must roll back', baseRevision: 0 }
        })
        stored = await database.execute({
          sql: 'SELECT count(*) AS count FROM pages WHERE path = ?',
          args: [path]
        })

        expect(fallbackSearch.response.status).toBe(200)
        expect(fallbackSearch.payload.total).toBe(2)
        expect(fallbackSearch.payload.items).toHaveLength(1)
      } finally {
        const rebuilt = await requestJson('/api/admin/rebuild-page-search-fts', {
          method: 'POST',
          headers: withSession('admin'),
          body: { limit: 9999, reset: true }
        })
        expect(rebuilt.response.status).toBe(200)
      }

      expect(failedWrite.response.status).toBe(500)
      expect(Number(stored.rows[0]?.count)).toBe(0)
    })

    test('reports missing internal pages and images without flagging an existing image', async () => {
      const path = 'characterization/admin-broken-source'
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: {
          path,
          body: [
            '# Broken source',
            '[missing page](/admin-missing-page)',
            '![missing image](/api/image/admin-missing.png)',
            '![existing image](/api/image/integration.png)'
          ].join('\n'),
          baseRevision: 0
        }
      })

      const report = await requestJson<{
        totalChecked: number
        brokenLinks: Array<{ sourcePath: string; targetUrl: string; type: string }>
        warnings: string[]
      }>('/api/admin/broken-links', { headers: withSession('admin') })

      expect(report.response.status).toBe(200)
      expect(report.payload.totalChecked).toBeGreaterThan(0)
      expect(report.payload.warnings).toEqual([])
      expect(report.payload.brokenLinks).toContainEqual(
        expect.objectContaining({ sourcePath: path, targetUrl: '/admin-missing-page', type: 'internal' })
      )
      expect(report.payload.brokenLinks).toContainEqual(
        expect.objectContaining({ sourcePath: path, targetUrl: '/api/image/admin-missing.png', type: 'image' })
      )
      expect(report.payload.brokenLinks).not.toContainEqual(
        expect.objectContaining({ sourcePath: path, targetUrl: '/api/image/integration.png' })
      )
    })
  })

  describe.sequential('page lifecycle and cache contracts', () => {
    const path = 'characterization/page'
    const originalBody = '# Characterization title\n<script>alert(1)</script>\nbody keyword'
    const sanitizedBody = '# Characterization title\n\nbody keyword'

    test('requires authentication for writes', async () => {
      const { response } = await requestJson('/api/page', {
        method: 'PUT',
        body: { path, body: originalBody, baseRevision: 0 }
      })

      expect(response.status).toBe(401)
    })

    test('rejects malformed wiki paths before read or delete queries', async () => {
      const malformedPath = encodeURIComponent('../secret')
      const [page, history, comments, deletion] = await Promise.all([
        requestJson<{ message: string }>(`/api/page?path=${malformedPath}`),
        requestJson<{ message: string }>(`/api/page/history?path=${malformedPath}`),
        requestJson<{ message: string }>(`/api/comment?path=${malformedPath}`),
        requestJson<{ message: string }>(`/api/page?path=${malformedPath}&baseRevision=1`, {
          method: 'DELETE',
          headers: withSession('editor')
        })
      ])

      expect(page.response.status).toBe(400)
      expect(history.response.status).toBe(400)
      expect(comments.response.status).toBe(400)
      expect(deletion.response.status).toBe(400)
      expect(page.payload.message).toBe('Path is required.')
      expect(history.payload.message).toBe('Path is required.')
      expect(comments.payload.message).toBe('Path is required.')
      expect(deletion.payload.message).toBe('Invalid payload.')
    })

    test('creates revision 1, sanitizes Markdown, and updates the search index', async () => {
      const { response, payload } = await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: {
          path,
          body: originalBody,
          baseRevision: 0,
          message: ' first revision ',
          minor: 0
        }
      })
      const searchIndex = await database.execute({
        sql: 'SELECT path, title, body, revision FROM page_search_fts WHERE path = ?',
        args: [path]
      })

      expect(response.status).toBe(200)
      expect(payload).toMatchObject({
        path,
        title: 'Characterization title',
        revision: 1,
        body: sanitizedBody,
        message: 'first revision',
        minor: 0
      })
      expect(JSON.parse(payload.bodyAst ?? '{}')).toHaveProperty('body')
      expect(searchIndex.rows[0]).toMatchObject({ path, revision: 1 })
    })

    test('does not derive a page title from a heading inside a code fence', async () => {
      const fencedPath = 'characterization/fenced-title'
      const created = await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: {
          path: fencedPath,
          body: ['```md', '# Code example', '```', '# Visible title'].join('\n'),
          baseRevision: 0
        }
      })

      expect(created.response.status).toBe(200)
      expect(created.payload.title).toBe('Visible title')
    })

    test('returns public CDN headers for cached reads and no-store for fresh reads', async () => {
      const cached = await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}`)
      const fresh = await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}&fresh=1`)

      expect(cached.response.status).toBe(200)
      expect(cached.payload.revision).toBe(1)
      expect(cached.response.headers.get('cache-control')).toBe('no-store')
      expect(cached.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=86400')
      expect(cached.response.headers.get('cache-tag')).toContain('popn-wiki:api:page')
      expect(fresh.response.headers.get('cloudflare-cdn-cache-control')).toBe('no-store')
    })

    test('rejects malformed revision identifiers', async () => {
      const malformed = await requestJson<{ message: string }>(
        `/api/page?path=${encodeURIComponent(path)}&revision=1abc`
      )
      const fractional = await requestJson<{ message: string }>(
        `/api/page?path=${encodeURIComponent(path)}&revision=1.5`
      )

      expect(malformed.response.status).toBe(400)
      expect(fractional.response.status).toBe(400)
      expect(malformed.payload.message).toBe('Invalid revision.')
      expect(fractional.payload.message).toBe('Invalid revision.')
    })

    test('rejects a stale base revision with the latest revision number', async () => {
      const { response, payload } = await requestJson<{ data: { latestRevision: number } }>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# stale update', baseRevision: 0 }
      })

      expect(response.status).toBe(409)
      expect(payload.data.latestRevision).toBe(1)
    })

    test('creates a new revision and returns history newest first', async () => {
      const update = await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Updated title\nupdated keyword', baseRevision: 1, minor: 1 }
      })
      const history = await requestJson<PageResponse[]>(`/api/page/history?path=${encodeURIComponent(path)}`)
      const revisionOne = await requestJson<PageResponse>(
        `/api/page?path=${encodeURIComponent(path)}&revision=1`
      )

      expect(update.payload).toMatchObject({ revision: 2, title: 'Updated title', minor: 1 })
      expect(history.payload.map((entry) => entry.revision)).toEqual([2, 1])
      expect(revisionOne.payload.body).toBe(sanitizedBody)
      expect(revisionOne.response.headers.get('cloudflare-cdn-cache-control')).toBe(
        'public, max-age=2592000, immutable'
      )
    })

    test('paginates page history and rejects malformed offsets', async () => {
      const secondEntry = await requestJson<PageResponse[]>(
        `/api/page/history?path=${encodeURIComponent(path)}&limit=1&offset=1`
      )
      const invalidOffset = await requestJson<{ message: string }>(
        `/api/page/history?path=${encodeURIComponent(path)}&offset=1.5`
      )

      expect(secondEntry.response.status).toBe(200)
      expect(secondEntry.payload.map((entry) => entry.revision)).toEqual([1])
      expect(invalidOffset.response.status).toBe(400)
      expect(invalidOffset.payload.message).toBe('Invalid pagination.')
    })

    test('deletion creates a tombstone and removes the search result', async () => {
      const deleted = await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}&baseRevision=2`, {
        method: 'DELETE',
        headers: withSession('editor')
      })
      const latest = await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}&fresh=1`)
      const search = await requestJson<{ total: number }>('/api/search?q=keyword')

      expect(deleted.payload).toMatchObject({ revision: 3, body: '', message: 'ページ削除' })
      expect(latest.payload).toMatchObject({ revision: 3, body: '' })
      expect(search.payload.total).toBe(0)
    })

    test('restore copies an old body into a new latest revision', async () => {
      const restored = await requestJson<PageResponse>('/api/page/restore', {
        method: 'POST',
        headers: withSession('editor'),
        body: { path, targetRevision: 1, baseRevision: 3 }
      })
      const search = await requestJson<{ total: number; items: Array<{ path: string; revision: number }> }>(
        '/api/search?q=keyword'
      )

      expect(restored.payload).toMatchObject({
        path,
        revision: 4,
        body: sanitizedBody,
        title: 'Characterization title',
        message: 'Restore revision 1'
      })
      expect(search.payload.items).toContainEqual(expect.objectContaining({ path, revision: 4 }))
    })

    test('sitemap includes active pages, excludes tombstones, and is CDN-cacheable', async () => {
      const deletedPath = 'characterization/sitemap-deleted'
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path: deletedPath, body: '# Removed from sitemap', baseRevision: 0 }
      })
      await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(deletedPath)}&baseRevision=1`, {
        method: 'DELETE',
        headers: withSession('editor')
      })

      const sitemap = await requestJson<Array<{ loc: string; lastmod: string }>>('/api/sitemap')

      expect(sitemap.response.status).toBe(200)
      expect(sitemap.payload).toContainEqual(expect.objectContaining({ loc: `/${path}` }))
      expect(sitemap.payload).not.toContainEqual(expect.objectContaining({ loc: `/${deletedPath}` }))
      expect(sitemap.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=86400')
      expect(sitemap.response.headers.get('cache-tag')).toContain('popn-wiki:api:sitemap')
    })
  })

  describe.sequential('concurrent page-write contracts', () => {
    test('accepts only one of two simultaneous page creations', async () => {
      const path = 'characterization/concurrent-create'
      const writes = await Promise.all(
        ['# First create', '# Second create'].map((body) =>
          requestJson<PageResponse & { data?: { latestRevision?: number } }>('/api/page', {
            method: 'PUT',
            headers: withSession('editor'),
            body: { path, body, baseRevision: 0 }
          })
        )
      )
      const statuses = writes.map(({ response }) => response.status).sort((left, right) => left - right)
      const rows = await database.execute({
        sql: 'SELECT revision, body FROM pages WHERE path = ? ORDER BY revision',
        args: [path]
      })

      expect(statuses).toEqual([200, 409])
      expect(rows.rows).toHaveLength(1)
      expect(Number(rows.rows[0]?.revision)).toBe(1)
      expect(['# First create', '# Second create']).toContain(String(rows.rows[0]?.body))
      expect(writes.find(({ response }) => response.status === 409)?.payload.data?.latestRevision).toBe(1)
    })

    test('accepts only one update for the same base revision', async () => {
      const path = 'characterization/concurrent-update'
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Base revision', baseRevision: 0 }
      })

      const writes = await Promise.all(
        ['# First update', '# Second update'].map((body) =>
          requestJson<PageResponse & { data?: { latestRevision?: number } }>('/api/page', {
            method: 'PUT',
            headers: withSession('editor'),
            body: { path, body, baseRevision: 1 }
          })
        )
      )
      const statuses = writes.map(({ response }) => response.status).sort((left, right) => left - right)
      const rows = await database.execute({
        sql: 'SELECT revision, body FROM pages WHERE path = ? ORDER BY revision',
        args: [path]
      })

      expect(statuses).toEqual([200, 409])
      expect(rows.rows.map((row) => Number(row.revision))).toEqual([1, 2])
      expect(['# First update', '# Second update']).toContain(String(rows.rows[1]?.body))
      expect(writes.find(({ response }) => response.status === 409)?.payload.data?.latestRevision).toBe(2)
    })

    test('does not create two revisions when deletion races with an update', async () => {
      const path = 'characterization/concurrent-delete'
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Revision before delete', baseRevision: 0 }
      })

      const [updated, deleted] = await Promise.all([
        requestJson<PageResponse & { data?: { latestRevision?: number } }>('/api/page', {
          method: 'PUT',
          headers: withSession('editor'),
          body: { path, body: `# Concurrent update\n${'body '.repeat(20_000)}`, baseRevision: 1 }
        }),
        requestJson<PageResponse & { data?: { latestRevision?: number } }>(
          `/api/page?path=${encodeURIComponent(path)}&baseRevision=1`,
          { method: 'DELETE', headers: withSession('other') }
        )
      ])
      const rows = await database.execute({
        sql: 'SELECT revision, body FROM pages WHERE path = ? ORDER BY revision',
        args: [path]
      })

      expect([updated.response.status, deleted.response.status].sort((left, right) => left - right)).toEqual([
        200, 409
      ])
      expect(rows.rows.map((row) => Number(row.revision))).toEqual([1, 2])
      expect(
        [updated, deleted].find(({ response }) => response.status === 409)?.payload.data?.latestRevision
      ).toBe(2)
    })

    test('accepts only one of two simultaneous restores', async () => {
      const path = 'characterization/concurrent-restore'
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: `# Restore target\n${'old body '.repeat(10_000)}`, baseRevision: 0 }
      })
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Current revision', baseRevision: 1 }
      })

      const restores = await Promise.all(
        ['editor', 'other'].map((session) =>
          requestJson<PageResponse & { data?: { latestRevision?: number } }>('/api/page/restore', {
            method: 'POST',
            headers: withSession(session as 'editor' | 'other'),
            body: { path, targetRevision: 1, baseRevision: 2 }
          })
        )
      )
      const rows = await database.execute({
        sql: 'SELECT revision FROM pages WHERE path = ? ORDER BY revision',
        args: [path]
      })

      expect(restores.map(({ response }) => response.status).sort((left, right) => left - right)).toEqual([200, 409])
      expect(rows.rows.map((row) => Number(row.revision))).toEqual([1, 2, 3])
      expect(restores.find(({ response }) => response.status === 409)?.payload.data?.latestRevision).toBe(3)
    })

    test('does not create two revisions when restore races with an update', async () => {
      const path = 'characterization/concurrent-restore-update'
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: `# Old revision\n${'old body '.repeat(10_000)}`, baseRevision: 0 }
      })
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Base revision', baseRevision: 1 }
      })

      const writes = await Promise.all([
        requestJson<PageResponse & { data?: { latestRevision?: number } }>('/api/page/restore', {
          method: 'POST',
          headers: withSession('editor'),
          body: { path, targetRevision: 1, baseRevision: 2 }
        }),
        requestJson<PageResponse & { data?: { latestRevision?: number } }>('/api/page', {
          method: 'PUT',
          headers: withSession('other'),
          body: { path, body: `# Concurrent revision\n${'new body '.repeat(10_000)}`, baseRevision: 2 }
        })
      ])
      const rows = await database.execute({
        sql: 'SELECT revision FROM pages WHERE path = ? ORDER BY revision',
        args: [path]
      })

      expect(writes.map(({ response }) => response.status).sort((left, right) => left - right)).toEqual([200, 409])
      expect(rows.rows.map((row) => Number(row.revision))).toEqual([1, 2, 3])
      expect(writes.find(({ response }) => response.status === 409)?.payload.data?.latestRevision).toBe(3)
    })
  })

  describe.sequential('comment ownership, threading, and list contracts', () => {
    const path = 'characterization/page'
    let rootCommentId = 0
    let replyId = 0
    let foreignRootId = 0

    test('caps comment list requests at 100 root comments', async () => {
      const limitedPath = 'characterization/comment-limit'
      const now = '2026-08-13T00:00:00.000Z'
      await database.batch(
        Array.from({ length: 101 }, (_, index) => ({
          sql: `
            INSERT INTO comments (path, body, body_ast, reply_to, user_id, created_at, updated_at, deleted_at)
            VALUES (?, ?, NULL, NULL, ?, ?, ?, NULL)
          `,
          args: [limitedPath, `comment ${index}`, users.editor.id, now, now]
        })),
        'write'
      )

      const listed = await requestJson<{ comments: CommentResponse[]; total: number }>(
        `/api/comment?path=${encodeURIComponent(limitedPath)}&limit=1000`
      )
      const malformedLimit = await requestJson<{ comments: CommentResponse[]; total: number }>(
        `/api/comment?path=${encodeURIComponent(limitedPath)}&limit=2abc`
      )

      expect(listed.response.status).toBe(200)
      expect(listed.payload.total).toBe(101)
      expect(listed.payload.comments).toHaveLength(100)
      expect(malformedLimit.payload.comments).toHaveLength(20)

      const lastPage = await requestJson<{ comments: CommentResponse[]; total: number }>(
        `/api/comment?path=${encodeURIComponent(limitedPath)}&limit=100&page=2&fresh=1`
      )
      const ninetyNine = await requestJson<{ comments: CommentResponse[] }>(
        `/api/comment?path=${encodeURIComponent(limitedPath)}&limit=99&fresh=1`
      )
      expect(lastPage.response.status).toBe(200)
      expect(lastPage.payload.total).toBe(101)
      expect(lastPage.payload.comments).toHaveLength(1)
      expect(ninetyNine.response.status).toBe(200)
      expect(ninetyNine.payload.comments).toHaveLength(99)
    })

    test('creates a sanitized root comment with its public profile', async () => {
      const { response, payload } = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('editor', { 'cf-connecting-ip': '203.0.113.31' }),
        body: { path, body: ' root <script>alert(1)</script> comment ' }
      })
      rootCommentId = payload.id

      expect(response.status).toBe(200)
      expect(payload).toMatchObject({
        path,
        body: 'root  comment',
        userId: users.editor.id,
        replyTo: null,
        profiles: { id: users.editor.id, name: users.editor.name }
      })
      expect(payload.profiles).not.toHaveProperty('password')
    })

    test('rejects a reply to a comment that does not exist', async () => {
      const before = await database.execute('SELECT count(*) AS count FROM comments')
      const invalid = await requestJson<{ message: string }>('/api/comment', {
        method: 'POST',
        headers: withSession('other', { 'cf-connecting-ip': '203.0.113.35' }),
        body: { path, body: 'orphan reply', replyTo: 999_999 }
      })
      const after = await database.execute('SELECT count(*) AS count FROM comments')

      expect(invalid.response.status).toBe(400)
      expect(invalid.payload.message).toBe('Invalid reply target.')
      expect(Number(after.rows[0]?.count)).toBe(Number(before.rows[0]?.count))
    })

    test('rejects a reply whose parent belongs to another page', async () => {
      const foreignRoot = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('editor', { 'cf-connecting-ip': '203.0.113.36' }),
        body: { path: 'characterization/other-page', body: 'foreign root' }
      })
      foreignRootId = foreignRoot.payload.id
      const invalid = await requestJson<{ message: string }>('/api/comment', {
        method: 'POST',
        headers: withSession('other', { 'cf-connecting-ip': '203.0.113.37' }),
        body: { path, body: 'cross-page reply', replyTo: foreignRootId }
      })

      expect(invalid.response.status).toBe(400)
      expect(invalid.payload.message).toBe('Invalid reply target.')
    })

    test('creates a reply and returns a flat depth-first thread', async () => {
      const reply = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('other', { 'cf-connecting-ip': '203.0.113.32' }),
        body: { path, body: 'reply body', replyTo: rootCommentId }
      })
      replyId = reply.payload.id
      const list = await requestJson<{
        comments: Array<CommentResponse & { replyToName: string | null }>
        total: number
      }>(`/api/comment?path=${encodeURIComponent(path)}&fresh=1`)

      expect(reply.payload).toMatchObject({ replyTo: rootCommentId, userId: users.other.id })
      expect(list.payload.total).toBe(1)
      expect(list.payload.comments.map((comment) => comment.id)).toEqual([rootCommentId, replyId])
      expect(list.payload.comments[1]?.replyToName).toBe(users.editor.name)
      expect(list.response.headers.get('cloudflare-cdn-cache-control')).toBe('no-store')
    })

    test('only the owner can edit a comment', async () => {
      const forbidden = await requestJson('/api/comment', {
        method: 'PUT',
        headers: withSession('other', { 'cf-connecting-ip': '203.0.113.33' }),
        body: { id: rootCommentId, body: 'not allowed' }
      })
      const updated = await requestJson<CommentResponse>('/api/comment', {
        method: 'PUT',
        headers: withSession('editor', { 'cf-connecting-ip': '203.0.113.34' }),
        body: { id: rootCommentId, body: 'updated root comment' }
      })

      expect(forbidden.response.status).toBe(404)
      expect(updated.payload.body).toBe('updated root comment')
      expect(updated.payload.profiles).not.toHaveProperty('password')
    })

    test('direct replies are visible to the owner of the parent comment', async () => {
      const replies = await requestJson<Array<{ id: number; path: string; userName: string }>>(
        '/api/reply?type=direct',
        { headers: withSession('editor') }
      )

      expect(replies.payload).toContainEqual(
        expect.objectContaining({ id: replyId, path, userName: users.other.name })
      )
    })

    test('comment search excludes deleted comments and reports the latest page title', async () => {
      const search = await requestJson<{
        total: number
        items: Array<{ id: number; pageTitle: string; snippet: string }>
      }>('/api/comment/search?q=updated')

      expect(search.payload.total).toBe(1)
      expect(search.payload.items[0]).toMatchObject({
        id: rootCommentId,
        pageTitle: 'Characterization title',
        snippet: 'updated root comment'
      })
    })

    test('an admin can soft-delete another user reply', async () => {
      const deleted = await requestJson<{ success: boolean; deletedCount: number }>(`/api/comment?id=${replyId}`, {
        method: 'DELETE',
        headers: withSession('admin')
      })
      const list = await requestJson<{ comments: CommentResponse[]; total: number }>(
        `/api/comment?path=${encodeURIComponent(path)}&fresh=1`
      )
      const row = await database.execute({
        sql: 'SELECT deleted_at FROM comments WHERE id = ?',
        args: [replyId]
      })

      expect(deleted.payload).toEqual({ success: true, deletedCount: 1 })
      expect(row.rows[0]?.deleted_at).toBeTruthy()
      expect(list.payload.comments.map((comment) => comment.id)).toEqual([rootCommentId])
    })

    test('soft-deletes an entire reply subtree and rejects further mutations', async () => {
      const cascadeRoot = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('editor', { 'cf-connecting-ip': '203.0.113.46' }),
        body: { path, body: 'cascade root marker' }
      })
      const cascadeChild = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('other', { 'cf-connecting-ip': '203.0.113.47' }),
        body: { path, body: 'cascade child marker', replyTo: cascadeRoot.payload.id }
      })
      const cascadeGrandchild = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('admin', { 'cf-connecting-ip': '203.0.113.48' }),
        body: { path, body: 'cascade grandchild marker', replyTo: cascadeChild.payload.id }
      })

      const deleted = await requestJson<{ success: boolean; deletedCount: number }>(
        `/api/comment?id=${cascadeRoot.payload.id}`,
        { method: 'DELETE', headers: withSession('editor') }
      )
      const stored = await database.execute({
        sql: 'SELECT id, deleted_at FROM comments WHERE id IN (?, ?, ?) ORDER BY id',
        args: [cascadeRoot.payload.id, cascadeChild.payload.id, cascadeGrandchild.payload.id]
      })
      const list = await requestJson<{ comments: CommentResponse[]; total: number }>(
        `/api/comment?path=${encodeURIComponent(path)}&fresh=1`
      )
      const search = await requestJson<{ total: number }>('/api/comment/search?q=cascade%20grandchild')
      const reply = await requestJson<{ message: string }>('/api/comment', {
        method: 'POST',
        headers: withSession('other', { 'cf-connecting-ip': '203.0.113.49' }),
        body: { path, body: 'must not survive', replyTo: cascadeGrandchild.payload.id }
      })
      const edit = await requestJson<{ message: string }>('/api/comment', {
        method: 'PUT',
        headers: withSession('admin', { 'cf-connecting-ip': '203.0.113.50' }),
        body: { id: cascadeGrandchild.payload.id, body: 'must not be editable' }
      })

      expect(deleted.payload).toEqual({ success: true, deletedCount: 3 })
      expect(stored.rows).toHaveLength(3)
      expect(stored.rows.every((row) => Boolean(row.deleted_at))).toBe(true)
      expect(list.payload.comments.map((comment) => comment.id)).not.toEqual(
        expect.arrayContaining([cascadeRoot.payload.id, cascadeChild.payload.id, cascadeGrandchild.payload.id])
      )
      expect(search.payload.total).toBe(0)
      expect(reply.response.status).toBe(400)
      expect(reply.payload.message).toBe('Invalid reply target.')
      expect(edit.response.status).toBe(404)
    })

    test('rejects a reply to a soft-deleted comment', async () => {
      const invalid = await requestJson<{ message: string }>('/api/comment', {
        method: 'POST',
        headers: withSession('editor', { 'cf-connecting-ip': '203.0.113.38' }),
        body: { path, body: 'reply to deleted comment', replyTo: replyId }
      })

      expect(invalid.response.status).toBe(400)
      expect(invalid.payload.message).toBe('Invalid reply target.')
    })

    test('recent comments reflects mutation invalidation', async () => {
      const recent = await requestJson<{
        data: Array<{ path: string; title: string; commenter: string; created_at: string }>
        total: number
      }>('/api/comment/recent?limit=10')

      expect(recent.payload.data).toContainEqual({
        path,
        title: 'Characterization title',
        commenter: users.editor.name,
        created_at: expect.any(String)
      })
      expect(recent.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=600')
    })
  })

  describe.sequential('reply thread-mode contracts', () => {
    const path = 'characterization/reply-thread'
    let rootId = 0
    let directReplyId = 0
    let grandchildId = 0

    async function insertComment(input: {
      body: string
      userId: number
      createdAt: string
      replyTo?: number
      deletedAt?: string
      targetPath?: string
    }) {
      const result = await database.execute({
        sql: `
          INSERT INTO comments (path, body, body_ast, reply_to, user_id, created_at, updated_at, deleted_at)
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        args: [
          input.targetPath ?? path,
          input.body,
          input.replyTo ?? null,
          input.userId,
          input.createdAt,
          input.createdAt,
          input.deletedAt ?? null
        ]
      })

      return Number(result.rows[0]?.id)
    }

    test('returns descendants in a participated thread while excluding own, deleted, and unrelated comments', async () => {
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Reply thread title', baseRevision: 0 }
      })
      rootId = await insertComment({
        body: 'thread root',
        userId: users.migration.id,
        createdAt: '2026-08-13T00:00:00.000Z'
      })
      directReplyId = await insertComment({
        body: 'direct foreign reply',
        userId: users.other.id,
        replyTo: rootId,
        createdAt: '2026-08-13T00:01:00.000Z'
      })
      grandchildId = await insertComment({
        body: 'x'.repeat(120),
        userId: users.admin.id,
        replyTo: directReplyId,
        createdAt: '2026-08-13T00:02:00.000Z'
      })
      await insertComment({
        body: 'own reply',
        userId: users.migration.id,
        replyTo: directReplyId,
        createdAt: '2026-08-13T00:03:00.000Z'
      })
      await insertComment({
        body: 'deleted reply',
        userId: users.other.id,
        replyTo: rootId,
        createdAt: '2026-08-13T00:04:00.000Z',
        deletedAt: '2026-08-13T00:05:00.000Z'
      })
      const unrelatedRoot = await insertComment({
        body: 'unrelated root',
        userId: users.other.id,
        createdAt: '2026-08-13T00:06:00.000Z',
        targetPath: 'characterization/unrelated-thread'
      })
      const unrelatedReply = await insertComment({
        body: 'unrelated reply',
        userId: users.admin.id,
        replyTo: unrelatedRoot,
        createdAt: '2026-08-13T00:07:00.000Z',
        targetPath: 'characterization/unrelated-thread'
      })

      const replies = await requestJson<
        Array<{ id: number; path: string; pageTitle: string; userName: string; bodyPreview: string }>
      >('/api/reply?type=thread', { headers: withSession('migration') })

      expect(replies.response.status).toBe(200)
      expect(replies.payload.map((reply) => reply.id)).toEqual([grandchildId, directReplyId])
      expect(replies.payload).not.toContainEqual(expect.objectContaining({ id: unrelatedReply }))
      expect(replies.payload[0]).toMatchObject({
        path,
        pageTitle: 'Reply thread title',
        userName: users.admin.name
      })
    })

    test('direct mode includes only direct replies from other users', async () => {
      const replies = await requestJson<Array<{ id: number }>>('/api/reply?type=direct', {
        headers: withSession('migration')
      })

      expect(replies.payload.map((reply) => reply.id)).toEqual([directReplyId])
    })

    test('applies limit and offset after filtering and truncates long previews', async () => {
      const firstPage = await requestJson<Array<{ id: number; bodyPreview: string }>>(
        '/api/reply?type=thread&limit=1&offset=0',
        { headers: withSession('migration') }
      )
      const secondPage = await requestJson<Array<{ id: number }>>('/api/reply?type=thread&limit=1&offset=1', {
        headers: withSession('migration')
      })

      expect(firstPage.payload).toEqual([
        expect.objectContaining({ id: grandchildId, bodyPreview: `${'x'.repeat(100)}...` })
      ])
      expect(secondPage.payload).toEqual([expect.objectContaining({ id: directReplyId })])
    })

    test('deduplicates shared ancestors before applying the traversal limit', async () => {
      const targetPath = 'characterization/shared-ancestors'
      try {
        let parent: number | undefined
        for (let depth = 0; depth < 10; depth++) {
          parent = await insertComment({
            body: `ancestor ${depth}`, userId: users.other.id, replyTo: parent,
            createdAt: '2099-01-01T00:00:00.000Z', targetPath
          })
        }
        await database.batch(Array.from({ length: 1000 }, () => ({
          sql: `INSERT INTO comments (path, body, reply_to, user_id, created_at, updated_at)
                VALUES (?, 'participation', ?, ?, '2099-01-02T00:00:00.000Z', '2099-01-02T00:00:00.000Z')`,
          args: [targetPath, parent!, users.editor.id]
        })), 'write')
        const own = await database.execute({ sql: 'SELECT id FROM comments WHERE path = ? AND user_id = ? LIMIT 1', args: [targetPath, users.editor.id] })
        const replyId = await insertComment({
          body: 'visible reply', userId: users.other.id, replyTo: Number(own.rows[0]?.id),
          createdAt: '2099-01-03T00:00:00.000Z', targetPath
        })
        const replies = await requestJson<Array<{ id: number; path: string }>>('/api/reply?type=thread', {
          headers: withSession('editor')
        })
        expect(replies.response.status).toBe(200)
        expect(replies.payload).toContainEqual(expect.objectContaining({ id: replyId }))
        expect(replies.payload.filter((reply) => reply.path === targetPath)).toHaveLength(11)

        // Corrupt legacy cycles must still terminate after removing the depth column.
        await database.execute({ sql: 'UPDATE comments SET reply_to = id WHERE id = ?', args: [Number(own.rows[0]?.id)] })
        const cyclic = await requestJson<Array<{ id: number }>>('/api/reply?type=thread', { headers: withSession('editor') })
        expect(cyclic.response.status).toBe(200)
      } finally {
        await database.execute({ sql: 'DELETE FROM comments WHERE path = ?', args: [targetPath] })
      }
    })

    test('requires authentication and rejects unsupported types or negative pagination', async () => {
      const anonymous = await requestJson('/api/reply?type=thread')
      const invalidType = await requestJson('/api/reply?type=unknown', { headers: withSession('migration') })
      const invalidLimit = await requestJson('/api/reply?type=thread&limit=-1', {
        headers: withSession('migration')
      })
      const invalidOffset = await requestJson('/api/reply?type=thread&offset=-1', {
        headers: withSession('migration')
      })

      expect(anonymous.response.status).toBe(401)
      expect(invalidType.response.status).toBe(400)
      expect(invalidLimit.response.status).toBe(400)
      expect(invalidOffset.response.status).toBe(400)
    })
  })

  describe.sequential('search and recent-page contracts', () => {
    const recentPath = 'characterization/recent'
    const deletedPath = 'characterization/deleted'

    test('ranks short-term search matches before splitting them into pages', async () => {
      const entries = [
        ['review/old-title', '階段', '練習の解説', '2025-01-01T00:00:00.000Z'],
        ['review/new-body', '最近の記録', '今日は階段を練習した', '2026-09-08T00:00:00.000Z']
      ]
      try {
        for (const [path, title, body, updatedAt] of entries) {
          await database.execute({
            sql: `INSERT INTO pages (path, title, body, revision, created_at, updated_at, created_by, updated_by)
                  VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
            args: [path!, title!, body!, updatedAt!, updatedAt!, users.editor.id, users.editor.id]
          })
        }
        const first = await requestJson<{ total: number; items: Array<{ path: string; score: number }> }>(
          '/api/search?q=階段&limit=1&page=1'
        )
        const second = await requestJson<{ items: Array<{ path: string; score: number }> }>(
          '/api/search?q=階段&limit=1&page=2'
        )
        expect(first.response.status).toBe(200)
        expect(first.payload.total).toBe(2)
        expect(first.payload.items[0]).toMatchObject({ path: 'review/old-title', score: 50 })
        expect(second.payload.items[0]).toMatchObject({ path: 'review/new-body', score: 10 })
      } finally {
        await database.execute("DELETE FROM pages WHERE path IN ('review/old-title', 'review/new-body')")
      }
    })

    test('search validates pagination and supports multiple exact terms', async () => {
      const invalid = await requestJson('/api/search?q=x')
      const invalidPage = await requestJson('/api/search?q=keyword&page=2abc')
      const invalidCommentLimit = await requestJson('/api/comment/search?q=keyword&limit=5.9')
      const valid = await requestJson<{
        total: number
        items: Array<{ path: string; matchTypes: string[]; snippetType: string }>
      }>('/api/search?q=body%20keyword&page=1&limit=5')

      expect(invalid.response.status).toBe(400)
      expect(invalidPage.response.status).toBe(400)
      expect(invalidCommentLimit.response.status).toBe(400)
      expect(valid.payload.items).toContainEqual(
        expect.objectContaining({
          path: 'characterization/page',
          matchTypes: expect.arrayContaining(['body']),
          snippetType: 'body'
        })
      )
    })

    test('recent pages keeps the latest major revision unless minor edits are requested', async () => {
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path: recentPath, body: '# Major revision', baseRevision: 0, minor: 0 }
      })
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path: recentPath, body: '# Minor revision', baseRevision: 1, minor: 1 }
      })

      const majorOnly = await requestJson<{ data: PageResponse[]; total: number }>('/api/page/recent?limit=50')
      const withMinor = await requestJson<{ data: PageResponse[]; total: number }>(
        '/api/page/recent?limit=50&includeMinor=true'
      )

      expect(majorOnly.payload.data.find((page) => page.path === recentPath)?.revision).toBe(1)
      expect(withMinor.payload.data.find((page) => page.path === recentPath)?.revision).toBe(2)
      expect(majorOnly.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=600')
    })

    test('recent pages excludes a page whose latest revision is a tombstone', async () => {
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path: deletedPath, body: '# Deleted later', baseRevision: 0 }
      })
      await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(deletedPath)}&baseRevision=1`, {
        method: 'DELETE',
        headers: withSession('editor')
      })

      const recent = await requestJson<{ data: PageResponse[] }>('/api/page/recent?limit=50&includeMinor=true')

      expect(recent.payload.data.some((page) => page.path === deletedPath)).toBe(false)
    })
  })

  describe.sequential('warmed internal-cache invalidation', () => {
    const path = 'characterization/cache'
    let firstCommentId = 0

    test('a page mutation invalidates a previously populated latest-page cache entry', async () => {
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Cached revision 1', baseRevision: 0 }
      })
      const primed = await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}`)

      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Cached revision 2', baseRevision: 1 }
      })
      const afterMutation = await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}`)

      expect(primed.payload).toMatchObject({ revision: 1, body: '# Cached revision 1' })
      expect(afterMutation.payload).toMatchObject({ revision: 2, body: '# Cached revision 2' })
      expect(afterMutation.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=86400')
    })

    test('a comment mutation switches a populated comment-list cache to a new version', async () => {
      const first = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('editor', { 'cf-connecting-ip': '203.0.113.41' }),
        body: { path, body: 'first cached comment' }
      })
      firstCommentId = first.payload.id
      const listUrl = `/api/comment?path=${encodeURIComponent(path)}&page=1&limit=5`
      const primed = await requestJson<{ comments: CommentResponse[]; total: number }>(listUrl)

      const second = await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('other', { 'cf-connecting-ip': '203.0.113.42' }),
        body: { path, body: 'second cached comment' }
      })
      const afterMutation = await requestJson<{ comments: CommentResponse[]; total: number }>(listUrl)

      expect(primed.payload).toMatchObject({ total: 1 })
      expect(primed.payload.comments.map((comment) => comment.id)).toEqual([firstCommentId])
      expect(afterMutation.payload.total).toBe(2)
      expect(afterMutation.payload.comments.map((comment) => comment.id)).toEqual(
        expect.arrayContaining([firstCommentId, second.payload.id])
      )
      expect(afterMutation.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=900')
    })

    test('a page mutation invalidates every query variant of the recent-page cache', async () => {
      const listUrl = '/api/page/recent?limit=7&page=1&includeMinor=true'
      const primed = await requestJson<{ data: PageResponse[]; total: number }>(listUrl)

      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path, body: '# Cached revision 3', baseRevision: 2 }
      })
      const afterMutation = await requestJson<{ data: PageResponse[]; total: number }>(listUrl)

      expect(primed.payload.data.find((page) => page.path === path)?.revision).toBe(2)
      expect(afterMutation.payload.data.find((page) => page.path === path)?.revision).toBe(3)
      expect(afterMutation.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=600')
    })

    test('a comment mutation invalidates a populated recent-comment cache', async () => {
      const listUrl = '/api/comment/recent?limit=7&page=1'
      const primed = await requestJson<{ data: Array<{ path: string }>; total: number }>(listUrl)
      const secondPath = 'characterization/cache-second'
      await requestJson<PageResponse>('/api/page', {
        method: 'PUT',
        headers: withSession('editor'),
        body: { path: secondPath, body: '# Cache second page', baseRevision: 0 }
      })
      await requestJson<CommentResponse>('/api/comment', {
        method: 'POST',
        headers: withSession('editor', { 'cf-connecting-ip': '203.0.113.43' }),
        body: { path: secondPath, body: 'new recent cached comment' }
      })
      const afterMutation = await requestJson<{ data: Array<{ path: string }>; total: number }>(listUrl)

      expect(primed.payload.data.some((entry) => entry.path === secondPath)).toBe(false)
      expect(afterMutation.payload.total).toBe(primed.payload.total + 1)
      expect(afterMutation.payload.data).toContainEqual(expect.objectContaining({ path: secondPath }))
      expect(afterMutation.response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=600')
    })
  })
})
