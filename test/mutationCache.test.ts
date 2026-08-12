import { describe, expect, spyOn, test } from 'bun:test'
import { runBestEffortCacheInvalidations } from '../server/utils/mutationCache'

describe('mutation cache invalidation', () => {
  test('reports success when every invalidation succeeds', async () => {
    const calls: string[] = []
    const success = await runBestEffortCacheInvalidations('TestCache', [
      {
        name: 'internal cache',
        run: async () => {
          calls.push('internal')
        }
      },
      {
        name: 'external cache',
        run: async () => {
          calls.push('external')
          return true
        }
      }
    ])

    expect(success).toBe(true)
    expect(calls).toEqual(['internal', 'external'])
  })

  test('attempts every invalidation and returns false when some fail', async () => {
    const warning = spyOn(console, 'warn').mockImplementation(() => {})
    const calls: string[] = []

    try {
      const success = await runBestEffortCacheInvalidations('TestCache', [
        {
          name: 'rejected cache',
          run: async () => {
            calls.push('rejected')
            throw new Error('storage unavailable')
          }
        },
        {
          name: 'unsuccessful cache',
          run: async () => {
            calls.push('unsuccessful')
            return false
          }
        },
        {
          name: 'healthy cache',
          run: async () => {
            calls.push('healthy')
            return true
          }
        }
      ])

      expect(success).toBe(false)
      expect(calls).toEqual(['rejected', 'unsuccessful', 'healthy'])
      expect(warning).toHaveBeenCalledWith(
        '[TestCache] Cache invalidation did not fully succeed: rejected cache: storage unavailable; unsuccessful cache'
      )
    } finally {
      warning.mockRestore()
    }
  })
})
