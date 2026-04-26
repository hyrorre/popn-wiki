import { describe, expect, test } from 'bun:test'
import { isLegacyPercentEncodedUrl } from '../utils/legacy-url'
import remarkLegacyUrl from '../utils/remark-legacy-url'

type TestNode = {
  type: string
  url?: string
  data?: {
    hProperties?: Record<string, unknown>
  }
  value?: string
  children?: TestNode[]
}

describe('remark legacy URL handling', () => {
  test('detects percent-encoded legacy URLs that MDC cannot decode as UTF-8', () => {
    expect(
      isLegacyPercentEncodedUrl(
        'http://www.wikihouse.com/popnwakaba/index.php?%A5%E9%A5%D4%A5%B9%A5%C8%A5%EA%A5%A2%BF%B7%B6%CA'
      )
    ).toBe(true)
    expect(isLegacyPercentEncodedUrl('https://example.com/path?x=1%202')).toBe(false)
  })

  test('moves unsafe link URLs to hProperties before hast conversion', () => {
    const url = 'http://www.wikihouse.com/popnwakaba/index.php?%A5%E9'
    const tree: TestNode = {
      type: 'root',
      children: [
        {
          type: 'link',
          url,
          children: [{ type: 'text', value: 'ラピストリア新曲' }]
        }
      ]
    }

    remarkLegacyUrl()(tree)

    const link = tree.children?.[0]
    expect(link?.url).toBe('#legacy-url')
    expect(link?.data?.hProperties).toEqual({
      legacyHref: url,
      rel: ['noopener', 'noreferrer'],
      target: '_blank'
    })
  })
})
