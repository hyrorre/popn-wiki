import { describe, expect, test } from 'bun:test'
import { selectNewestPage } from '../utils/pageFreshness'

describe('page freshness', () => {
  test('keeps a saved revision while the API cache is stale', () => {
    const fetched = { path: 'playground/page', revision: 10 }
    const pending = { path: 'playground/page', revision: 11 }

    expect(selectNewestPage('playground/page', fetched, pending)).toBe(pending)
  })

  test('uses the API response after it catches up', () => {
    const fetched = { path: 'playground/page', revision: 11 }
    const pending = { path: 'playground/page', revision: 11 }

    expect(selectNewestPage('playground/page', fetched, pending)).toBe(fetched)
  })

  test('does not reuse data from a different route', () => {
    const fetched = { path: 'playground/old', revision: 20 }

    expect(selectNewestPage('playground/new', fetched, null)).toBeUndefined()
  })
})
