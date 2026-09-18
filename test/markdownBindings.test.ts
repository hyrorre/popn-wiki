import { describe, expect, test } from 'bun:test'
import { parseSafeMarkdown } from '../server/utils/markdown'
import { sanitizeMdcParserResult } from '../utils/markdown-security'

describe('safe Markdown text bindings', () => {
  test.each([
    { path: 'count', data: { count: 0 }, expected: '0' },
    { path: 'ready', data: { ready: false }, expected: 'false' },
    { path: 'label', data: { label: '' }, expected: '' },
    { path: 'missing', data: {}, expected: 'fallback' },
    { path: 'label', data: { label: null }, expected: 'fallback' },
    { path: 'label', data: { label: { nested: 'hidden' } }, expected: '' },
    { path: 'count', data: { count: Infinity }, expected: '' },
    { path: '$document.items[0]', data: { items: ['first'] }, expected: 'first' }
  ])('handles scalar and fallback boundaries: $path / $expected', ({ path, data, expected }) => {
    const result = sanitizeMdcParserResult({
      data: { title: '', description: '', ...data },
      excerpt: undefined,
      toc: undefined,
      body: {
        type: 'root',
        children: [{ type: 'element', tag: 'binding', props: { value: path, defaultValue: 'fallback' }, children: [] }]
      }
    })
    expect(result.body.children).toEqual([{ type: 'text', value: expected }])
  })

  test('resolves scalar metadata and nested paths without interpreting HTML', async () => {
    const source = [
      '---',
      'label: "<script>example</script>"',
      'count: 42',
      'ready: false',
      'nested:',
      '  name: Name',
      'items:',
      '  - First',
      '---',
      '{{ label }} / {{ count }} / {{ ready }} / {{ nested.name }} / {{ items[0] }} / {{ $doc.label }}'
    ].join('\n')
    const { ast, sanitizedMarkdown } = await parseSafeMarkdown(source)
    expect(sanitizedMarkdown).toBe(source)
    const result = JSON.stringify(ast.body)
    expect(result).toContain('<script>example</script>')
    expect(result).toContain('42')
    expect(result).toContain('false')
    expect(result).toContain('Name')
    expect(result).toContain('First')
    expect(result).not.toContain('"tag":"script"')
    expect(result).not.toContain('"tag":"binding"')
  })

  test('does not execute functions, getters, expressions or traverse prototypes', () => {
    let called = false
    const data = {
      title: '',
      description: '',
      nested: {
        fn: () => {
          called = true
          return 'function'
        },
        get getter() {
          called = true
          return 'getter'
        }
      }
    }
    for (const value of [
      'nested.fn',
      'nested.getter',
      'constructor.name',
      '__proto__.value',
      'nested.fn()',
      '$route.path'
    ]) {
      const result = sanitizeMdcParserResult({
        data,
        excerpt: undefined,
        toc: undefined,
        body: { type: 'root', children: [{ type: 'element', tag: 'binding', props: { value }, children: [] }] }
      })
      expect(result.body.children).toEqual([{ type: 'text', value: '' }])
    }
    expect(called).toBe(false)
  })
})
