import { describe, expect, test } from 'bun:test'
import { sanitizeDangerousMarkdownHtml } from '../server/utils/markdown'

describe('Markdown sanitizer', () => {
  test('removes script blocks with their content', () => {
    const markdown = '# Title\n<script>alert("xss")</script>\nbody'

    expect(sanitizeDangerousMarkdownHtml(markdown)).toBe('# Title\n\nbody')
  })

  test('removes iframe blocks with their content', () => {
    const markdown = 'before\n<iframe src="https://example.com"></iframe>\nafter'

    expect(sanitizeDangerousMarkdownHtml(markdown)).toBe('before\n\nafter')
  })

  test('removes case-insensitive and attribute-heavy tags', () => {
    const markdown = '<SCRIPT type="text/javascript">alert(1)</SCRIPT>\n<iframe srcdoc="<p>x</p>" />'

    expect(sanitizeDangerousMarkdownHtml(markdown)).toBe('\n')
  })

  test('keeps ordinary markdown and allowed raw html', () => {
    const markdown = 'hello **world**\n<div>allowed</div>'

    expect(sanitizeDangerousMarkdownHtml(markdown)).toBe(markdown)
  })
})
