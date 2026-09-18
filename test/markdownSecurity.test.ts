import { describe, expect, test } from 'bun:test'
import { parseSafeMarkdown } from '../server/utils/markdown'
import { MARKDOWN_RENDER_VERSION, sanitizeLinkTarget, sanitizeUnknownMdcDocument } from '../utils/markdown-security'
import { isLegacyPercentEncodedUrl } from '../utils/legacy-url'

describe('Markdown AST security', () => {
  test('removes entity-encoded javascript URLs and SVG from raw HTML', async () => {
    const { ast } = await parseSafeMarkdown('<svg><a xlink:href="jav&#x61;script:alert(1)">unsafe</a></svg><p>safe</p>')

    expect(JSON.stringify(ast)).not.toContain('javascript:')
    expect(JSON.stringify(ast)).not.toContain('"tag":"svg"')
    expect(JSON.stringify(ast)).toContain('safe')
  })

  test('does not preserve non-HTTP invalid-percent URLs as legacy links', async () => {
    const { ast } = await parseSafeMarkdown('[unsafe](javascript:alert%281%29//%FF)')
    const serialized = JSON.stringify(ast)

    expect(serialized).not.toContain('javascript:')
    expect(serialized).not.toContain('legacyHref')
  })

  test('keeps the intended legacy HTTP links', async () => {
    const url = 'http://www.wikihouse.com/popnwakaba/index.php?%A5%E9'
    const { ast } = await parseSafeMarkdown(`[legacy](${url})`)

    expect(JSON.stringify(ast)).toContain(`"legacyHref":"${url}"`)
  })

  test('allows known MDC components but unwraps arbitrary application components', async () => {
    const { ast } = await parseSafeMarkdown(
      '::recent-edits{limit=10}\n::\n\n::profile-delete\nDo not render this component.\n::'
    )
    const serialized = JSON.stringify(ast)

    expect(serialized).toContain('"tag":"recent-edits"')
    expect(serialized).not.toContain('"tag":"profile-delete"')
    expect(serialized).toContain('Do not render this component.')
  })

  test('preserves named slots for allowed MDC components', async () => {
    const { ast } = await parseSafeMarkdown('::card\n#title\nHeading\n#default\nBody\n::')
    const serialized = JSON.stringify(ast)

    expect(serialized).toContain('"tag":"card"')
    expect(serialized).toContain('"tag":"template"')
    expect(serialized).toContain('"v-slot:title":""')
  })

  test('sanitizes stored MDC ASTs even when marked with the current render version', () => {
    const document = sanitizeUnknownMdcDocument({
      renderVersion: MARKDOWN_RENDER_VERSION,
      data: { title: '', description: '' },
      body: {
        type: 'root',
        children: [
          {
            type: 'element',
            tag: 'a',
            props: { legacyHref: 'javascript:alert(1)', href: '/safe', onClick: 'alert(1)' },
            children: [{ type: 'text', value: 'link' }]
          },
          {
            type: 'element',
            tag: 'svg',
            props: {},
            children: [{ type: 'text', value: 'drop this too' }]
          }
        ]
      },
      excerpt: undefined,
      toc: undefined
    })

    expect(document).not.toBeNull()
    expect(document?.body.children).toEqual([
      {
        type: 'element',
        tag: 'a',
        props: { href: '/safe' },
        children: [{ type: 'text', value: 'link' }]
      }
    ])
  })

  test('removes frontmatter renderer overrides on both new and stored documents', async () => {
    const { ast } = await parseSafeMarkdown(
      [
        '---',
        'title: Safe title',
        'component:',
        '  name: div',
        '  props:',
        '    innerHTML: "<b>injected</b>"',
        'mdc:',
        '  components:',
        '    p: iframe',
        '---',
        'Normal body'
      ].join('\n')
    )
    expect(ast.data.title).toBe('Safe title')
    expect(ast.data).not.toHaveProperty('component')
    expect(ast.data).not.toHaveProperty('mdc')

    const stored = sanitizeUnknownMdcDocument({
      ...ast,
      data: { ...ast.data, component: 'iframe', mdc: { components: { p: 'iframe' } } }
    })
    expect(stored?.data).toEqual(ast.data)
  })

  test('accepts safe navigation targets and rejects executable schemes', () => {
    expect(sanitizeLinkTarget('/wiki/path')).toBe('/wiki/path')
    expect(sanitizeLinkTarget('https://example.com/%A5')).toBe('https://example.com/%A5')
    expect(sanitizeLinkTarget('jav&#x61;script:alert(1)')).toBeNull()
    expect(sanitizeLinkTarget('java\nscript:alert(1)')).toBeNull()
    expect(isLegacyPercentEncodedUrl('javascript:alert%281%29//%FF')).toBe(false)
  })
})

test('only permits validated Shiki variables and keeps arbitrary stylesheets blocked', async () => {
  const { ast } = await parseSafeMarkdown(
    '<span style="--shiki-light:#AABBCC;--shiki-default-font-weight:700;--shiki-dark:url(https://example.com);--shiki-dark-font-style:expression(alert(1));--unrelated:red">code</span><style>body { display:none }</style>'
  )
  const serialized = JSON.stringify(ast.body)
  expect(serialized).toContain('--shiki-light: #AABBCC')
  expect(serialized).toContain('--shiki-default-font-weight: 700')
  expect(serialized).not.toContain('url(')
  expect(serialized).not.toContain('expression(')
  expect(serialized).not.toContain('--unrelated')
  expect(serialized).not.toContain('"tag":"style"')
})

test('rejects executable or indirect image sizing styles', async () => {
  for (const value of [
    'url(https://example.com)',
    'expression(alert(1))',
    'var(--external)',
    'calc(100% + 1px)',
    '-10px',
    '100px !important'
  ]) {
    const { ast } = await parseSafeMarkdown(
      `<img src="/example.png" style="width:${value};height:${value};max-width:${value}">`
    )
    expect(JSON.stringify(ast.body)).not.toContain('"style"')
  }
})
