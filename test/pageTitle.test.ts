import { describe, expect, test } from 'bun:test'
import { extractTitleFromMarkdown, resolvePageTitle } from '../server/utils/page'

describe('page title resolution', () => {
  test('uses the first Markdown heading and trims its text', () => {
    expect(extractTitleFromMarkdown('intro\n##  Page title  \n# Later title')).toBe('Page title')
  })

  test('removes MDC attributes wrapped around a heading title', () => {
    expect(extractTitleFromMarkdown('# [Styled title]{.text-primary}')).toBe('Styled title')
  })

  test('ignores heading examples inside backtick and tilde code fences', () => {
    const body = [
      '```md',
      '# Backtick example',
      '```',
      '~~~markdown',
      '# Tilde example',
      '~~~',
      '# Actual title'
    ].join('\n')

    expect(extractTitleFromMarkdown(body)).toBe('Actual title')
  })

  test('returns null when no heading exists', () => {
    expect(extractTitleFromMarkdown('plain paragraph')).toBeNull()
    expect(extractTitleFromMarkdown('```\n# fenced only\n```')).toBeNull()
  })

  test('falls back to Home or the last path segment', () => {
    expect(resolvePageTitle('plain paragraph', '/')).toBe('Home')
    expect(resolvePageTitle('plain paragraph', 'genre/popn')).toBe('popn')
    expect(resolvePageTitle('# Explicit', 'genre/popn')).toBe('Explicit')
  })
})
