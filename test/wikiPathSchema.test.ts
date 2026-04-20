import { describe, expect, test } from 'bun:test'
import { wikiPathSchema } from '../shared/zod'

describe('Wiki path schema', () => {
  test('accepts root and nested wiki paths', () => {
    expect(wikiPathSchema.safeParse('/').success).toBe(true)
    expect(wikiPathSchema.safeParse('/genre/popn').success).toBe(true)
    expect(wikiPathSchema.safeParse('genre/popn').success).toBe(true)
  })

  test('trims accepted paths', () => {
    const result = wikiPathSchema.parse(' /genre/popn ')

    expect(result).toBe('/genre/popn')
  })

  test('rejects traversal-like segments', () => {
    expect(wikiPathSchema.safeParse('../secret').success).toBe(false)
    expect(wikiPathSchema.safeParse('/genre/../secret').success).toBe(false)
    expect(wikiPathSchema.safeParse('/genre/./secret').success).toBe(false)
  })

  test('rejects ambiguous separators and control characters', () => {
    expect(wikiPathSchema.safeParse('/genre//popn').success).toBe(false)
    expect(wikiPathSchema.safeParse('/genre\\popn').success).toBe(false)
    expect(wikiPathSchema.safeParse('/genre\npopn').success).toBe(false)
  })

  test('rejects empty and overlong paths', () => {
    expect(wikiPathSchema.safeParse('').success).toBe(false)
    expect(wikiPathSchema.safeParse('x'.repeat(513)).success).toBe(false)
  })
})
