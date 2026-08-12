import { rmSync } from 'node:fs'
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
const password = 'test-password'
const legacyBcryptHash = '$2y$04$abcdefghijklmnopqrstuuobFaEJANklW4I6zZpcLRbXjrME4Qa2m'

const users = {
  editor: { id: 101, name: 'Editor', email: 'editor@example.com', role: 'user' },
  other: { id: 102, name: 'Other', email: 'other@example.com', role: 'user' },
  admin: { id: 103, name: 'Admin', email: 'admin@example.com', role: 'admin' },
  unconfirmed: { id: 104, name: 'Pending', email: 'pending@example.com', role: 'user' },
  migration: { id: 105, name: 'Legacy', email: 'legacy@example.com', role: 'user' }
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
        preset: 'node-server'
      },
      hub: {
        dir: testDataDir,
        blob: false,
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
  })

  afterAll(() => {
    database.close()
  })

  describe.sequential('authentication contracts', () => {
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

    test('verification tokens are valid only once', async () => {
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.unconfirmed.id, 'verify-once', 'verification', Date.now() + 60_000]
      })

      const first = await requestJson<{ message: string }>('/api/auth/verify?token=verify-once')
      const second = await requestJson<{ message: string }>('/api/auth/verify?token=verify-once')

      expect(first.response.status).toBe(200)
      expect(first.payload.message).toBe('Email verified successfully.')
      expect(second.response.status).toBe(400)
      expect(second.payload.message).toBe('Invalid or expired token')
    })

    test('a password reset confirms the account and consumes the token', async () => {
      await database.execute({
        sql: 'UPDATE users SET confirmed = 0 WHERE id = ?',
        args: [users.unconfirmed.id]
      })
      await database.execute({
        sql: 'INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
        args: [users.unconfirmed.id, 'reset-once', 'reset', Date.now() + 60_000]
      })

      const result = await requestJson<{ message: string }>('/api/auth/reset', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.23' },
        body: { token: 'reset-once', password: 'brand-new-password!' }
      })
      const userResult = await database.execute({
        sql: 'SELECT confirmed, password FROM users WHERE id = ?',
        args: [users.unconfirmed.id]
      })
      const tokenResult = await database.execute({
        sql: 'SELECT count(*) AS count FROM tokens WHERE token = ?',
        args: ['reset-once']
      })

      expect(result.response.status).toBe(200)
      expect(result.payload.message).toBe('Password has been reset successfully.')
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

    test('deletion creates a tombstone and removes the search result', async () => {
      const deleted = await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(path)}`, {
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
        body: { path, targetRevision: 1 }
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
  })

  describe.sequential('comment ownership, threading, and list contracts', () => {
    const path = 'characterization/page'
    let rootCommentId = 0
    let replyId = 0
    let foreignRootId = 0

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
      const deleted = await requestJson<{ success: boolean }>(`/api/comment?id=${replyId}`, {
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

      expect(deleted.payload).toEqual({ success: true })
      expect(row.rows[0]?.deleted_at).toBeTruthy()
      expect(list.payload.comments.map((comment) => comment.id)).toEqual([rootCommentId])
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

  describe.sequential('search and recent-page contracts', () => {
    const recentPath = 'characterization/recent'
    const deletedPath = 'characterization/deleted'

    test('search validates pagination and supports multiple exact terms', async () => {
      const invalid = await requestJson('/api/search?q=x')
      const valid = await requestJson<{
        total: number
        items: Array<{ path: string; matchTypes: string[]; snippetType: string }>
      }>('/api/search?q=body%20keyword&page=1&limit=5')

      expect(invalid.response.status).toBe(400)
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
      await requestJson<PageResponse>(`/api/page?path=${encodeURIComponent(deletedPath)}`, {
        method: 'DELETE',
        headers: withSession('editor')
      })

      const recent = await requestJson<{ data: PageResponse[] }>('/api/page/recent?limit=50&includeMinor=true')

      expect(recent.payload.data.some((page) => page.path === deletedPath)).toBe(false)
    })
  })
})
