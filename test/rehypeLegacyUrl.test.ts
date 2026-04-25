import { describe, expect, test } from 'bun:test'
import rehypeLegacyUrl, { isLegacyPercentEncodedUrl } from '../utils/rehype-legacy-url'

describe('rehype legacy URL handling', () => {
  test('detects percent-encoded legacy URLs that MDC cannot decode as UTF-8', () => {
    expect(
      isLegacyPercentEncodedUrl(
        'http://www.wikihouse.com/popnwakaba/index.php?%A5%E9%A5%D4%A5%B9%A5%C8%A5%EA%A5%A2%BF%B7%B6%CA'
      )
    ).toBe(true)
    expect(isLegacyPercentEncodedUrl('https://example.com/path?x=1%202')).toBe(false)
  })

  test('moves unsafe hrefs to legacyHref before MDC validates props', () => {
    const href = 'http://www.wikihouse.com/popnwakaba/index.php?%A5%E9'
    const tree: {
      type: string
      children: Array<{
        type: string
        tagName: string
        properties: Record<string, unknown>
        children: Array<{ type: string; value: string }>
      }>
    } = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: { href },
          children: [{ type: 'text', value: href }]
        }
      ]
    }

    rehypeLegacyUrl()(tree)

    expect(tree.children[0]?.properties).toEqual({
      href: '#legacy-url',
      legacyHref: href,
      rel: ['noopener', 'noreferrer'],
      target: '_blank'
    })
  })
})
