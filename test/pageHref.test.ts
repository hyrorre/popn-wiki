import { describe, expect, test } from 'bun:test'
import { pageHref } from '../utils/pageHref'

describe('page links', () => {
  test('links the top page to the site root instead of a protocol-relative URL', () => {
    expect(pageHref('/')).toBe('/')
  })

  test('prefixes other stored paths with a single slash', () => {
    expect(pageHref('難易度表/lv50')).toBe('/難易度表/lv50')
  })
})
