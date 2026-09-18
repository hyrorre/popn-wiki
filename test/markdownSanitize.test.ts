import { describe, expect, test } from 'bun:test'
import { sanitizeDangerousMarkdownHtml } from '../server/utils/markdown'

describe('Markdown sanitizer', () => {
  test('removes inline unsafe elements and their contents', () => {
    expect(sanitizeDangerousMarkdownHtml('root <script>alert(1)</script> comment')).toBe('root  comment')
  })

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
    expect(sanitizeDangerousMarkdownHtml("<div onmouseover='xss()'>")).toBe('<div>')
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

describe('literal Markdown content', () => {
  test.each([
    '`<script>example</script>`',
    '``<script>`example`</script>``',
    '```html\n<script>example</script>\n<img src="/x" onerror="example()">\n```',
    '~~~html\n<iframe src="/example">Example</iframe>\n~~~',
    '    <script>example</script>\n    <img onerror="example()">',
    '\\<script>example\\</script>',
    '[example](/safe "<script>example</script>")'
  ])('preserves literal source: %s', (source) => {
    expect(sanitizeDangerousMarkdownHtml(source)).toBe(source)
  })

  test('removes real HTML while preserving adjacent fenced examples', () => {
    const source = '```html\n<script>example</script>\n```\n\n<script>unsafe()</script>'
    expect(sanitizeDangerousMarkdownHtml(source)).toBe('```html\n<script>example</script>\n```\n\n')
  })

  test.each([
    '> ```html\n> <script>example()</script>\n> ```',
    '- Example\n\n  ```html\n  <img onerror="example()">\n  ```',
    '---\nlabel: "<script>example()</script>"\n---\n\n`<iframe>literal</iframe>`',
    '---\r\nlabel: "<script>example()</script>"\r\n---\r\n\r\n```html\r\n<script>example()</script>\r\n```'
  ])('preserves nested examples and metadata beside actual unsafe HTML: %s', (literal) => {
    const source = `${literal}\n\n<script>unsafe()</script>\n\n<img src="/safe.png" onerror="unsafe()">`
    const expected = `${literal}\n\n\n\n<img src="/safe.png">`
    expect(sanitizeDangerousMarkdownHtml(source)).toBe(expected)
    expect(sanitizeDangerousMarkdownHtml(expected)).toBe(expected)
  })
})
