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

  test('removes unclosed blocked tags without dropping following markdown', () => {
    const markdown = 'before\n<script src="/x.js">\nafter'

    expect(sanitizeDangerousMarkdownHtml(markdown)).toBe('before\n\nafter')
  })

  test('removes closing blocked tags by themselves', () => {
    const markdown = 'before</iframe>after'

    expect(sanitizeDangerousMarkdownHtml(markdown)).toBe('beforeafter')
  })

  test('keeps ordinary markdown and allowed raw html', () => {
    const markdown = 'hello **world**\n<div>allowed</div>'

    expect(sanitizeDangerousMarkdownHtml(markdown)).toBe(markdown)
  })

  test('removes object and embed blocks', () => {
    expect(sanitizeDangerousMarkdownHtml('<object data="x.swf"></object>')).toBe('')
    expect(sanitizeDangerousMarkdownHtml('<embed src="x.swf" />')).toBe('')
  })

  test('strips on* event handler attributes from allowed tags', () => {
    expect(sanitizeDangerousMarkdownHtml('<svg onload="xss()">')).toBe('<svg>')
    expect(sanitizeDangerousMarkdownHtml('<img src="x.png" onerror="xss()">')).toBe('<img src="x.png">')
    expect(sanitizeDangerousMarkdownHtml('<div onmouseover=\'xss()\'>')).toBe('<div>')
  })

  test('strips javascript: URLs from href and src attributes', () => {
    expect(sanitizeDangerousMarkdownHtml('<a href="javascript:void(0)">link</a>')).toBe('<a>link</a>')
    expect(sanitizeDangerousMarkdownHtml('<img src="javascript:xss()">')).toBe('<img>')
  })

  test('keeps safe href and src attributes intact', () => {
    expect(sanitizeDangerousMarkdownHtml('<a href="https://example.com">link</a>')).toBe(
      '<a href="https://example.com">link</a>'
    )
    expect(sanitizeDangerousMarkdownHtml('<img src="/image.png" alt="photo">')).toBe(
      '<img src="/image.png" alt="photo">'
    )
  })
})
