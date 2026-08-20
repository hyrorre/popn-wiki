import { describe, expect, test } from 'bun:test'
import { getLatestPageCacheKey, getRevisionPageCacheKey } from '../server/utils/pageCache'

describe('page cache keys', () => {
  test('isolates delayed latest-page writes in their original cache generation', () => {
    const previous = getLatestPageCacheKey('nested/page', 'old-generation')
    const current = getLatestPageCacheKey('nested/page', 'new-generation')

    expect(previous).not.toBe(current)
    expect(previous).toContain('nested%2Fpage')
  })

  test('keeps immutable revision keys independent from the latest-page generation', () => {
    expect(getRevisionPageCacheKey('nested/page', 12)).toBe('pages:revision:nested%2Fpage:12')
  })
})
