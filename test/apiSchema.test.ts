import { describe, expect, test } from 'bun:test'
import {
  createCommentSchema,
  emailOnlySchema,
  signinSchema,
  updateCommentSchema,
  updatePageSchema,
  updateProfileSchema
} from '../shared/zod'

describe('API payload schemas', () => {
  test('signin normalizes email and preserves password', () => {
    const result = signinSchema.parse({
      email: ' USER@Example.COM ',
      password: 'legacy-password'
    })

    expect(result).toEqual({
      email: 'user@example.com',
      password: 'legacy-password'
    })
  })

  test('signin rejects malformed payloads', () => {
    expect(signinSchema.safeParse({ email: 'not-email', password: 'password' }).success).toBe(false)
    expect(signinSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false)
    expect(signinSchema.safeParse({ email: 'user@example.com', password: 'x'.repeat(129) }).success).toBe(false)
  })

  test('email-only schema normalizes email', () => {
    const result = emailOnlySchema.parse({ email: ' USER@Example.COM ' })

    expect(result.email).toBe('user@example.com')
  })

  test('comment creation trims body and supports optional replyTo', () => {
    const result = createCommentSchema.parse({
      path: '/page',
      body: ' hello ',
      replyTo: undefined
    })

    expect(result).toEqual({
      path: '/page',
      body: 'hello',
      replyTo: null
    })
  })

  test('comment schemas reject invalid ids and oversized body', () => {
    expect(updateCommentSchema.safeParse({ id: 0, body: 'hello' }).success).toBe(false)
    expect(updateCommentSchema.safeParse({ id: 1, body: '' }).success).toBe(false)
    expect(updateCommentSchema.safeParse({ id: 1, body: 'x'.repeat(10001) }).success).toBe(false)
  })

  test('profile update rejects invalid names and overlong avatars', () => {
    expect(updateProfileSchema.safeParse({ name: '', avatar: null }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ name: 'ok', avatar: 'x'.repeat(2049) }).success).toBe(false)
    expect(updateProfileSchema.safeParse({ name: 'ok', avatar: '' }).success).toBe(true)
  })

  test('page update accepts valid payloads', () => {
    const result = updatePageSchema.parse({
      path: '/music/popn',
      body: '# Title',
      baseRevision: 1,
      message: ' edit ',
      minor: 1
    })

    expect(result).toEqual({
      path: '/music/popn',
      body: '# Title',
      baseRevision: 1,
      message: 'edit',
      minor: 1
    })
  })

  test('page update rejects invalid revision and minor values', () => {
    expect(updatePageSchema.safeParse({ path: '/', body: '', baseRevision: -1 }).success).toBe(false)
    expect(updatePageSchema.safeParse({ path: '/', body: '', baseRevision: 0, minor: 2 }).success).toBe(false)
  })
})
