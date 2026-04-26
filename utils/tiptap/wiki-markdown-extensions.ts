import { Mark, Node, mergeAttributes } from '@tiptap/core'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import type { JSONContent, MarkdownToken } from '@tiptap/core'

function getRaw(token: MarkdownToken) {
  return String(token.raw || token.text || '')
}

function classifyRawBlock(raw: string) {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith(':ImageUploader')) return '画像アップロード'
  if (trimmed.startsWith('<!--')) return 'HTML コメント'
  if (trimmed.startsWith('::sortable')) return 'ソート表'
  if (trimmed.startsWith('::')) return 'MDC ブロック'
  if (trimmed.startsWith('|')) return '拡張テーブル'
  if (/^[;:][ \t]+/.test(trimmed)) return '定義リスト'
  if (/^<details\b/i.test(trimmed)) return 'details'
  return 'Wiki 拡張構文'
}

function parseInlineAttrs(rawAttrs: string) {
  const result: Record<string, string> = {}
  const classes = [...rawAttrs.matchAll(/(?:^|\s)\.([A-Za-z0-9_-]+)/g)].map((match) => match[1]).filter(Boolean)
  const visibleClasses = classes.filter((className) => className !== 'hidden')
  const style = rawAttrs.match(/style=(?:"([^"]*)"|'([^']*)')/)?.slice(1).find(Boolean)

  if (visibleClasses.length > 0) result.class = visibleClasses.join(' ')
  if (classes.includes('hidden')) result.class = [result.class, 'wiki-hidden-attribute'].filter(Boolean).join(' ')
  if (style) result.style = style

  return result
}

function readFenceBlock(src: string) {
  const opening = src.match(/^::[A-Za-z][\w-]*(?:\{[^\n]*\})?[^\n]*\n?/)
  if (!opening) return null

  const rest = src.slice(opening[0].length)
  const closing = rest.match(/(?:^|\n)::[ \t]*(?=\n|$)/)
  if (!closing || closing.index === undefined) return null

  const end = opening[0].length + closing.index + closing[0].length
  return src.slice(0, end)
}

function readTableBlock(src: string) {
  const lines = src.split('\n')
  const tableLines: string[] = []

  for (const line of lines) {
    if (!line.trim()) {
      if (tableLines.length > 0) break
      return null
    }
    if (!line.trimStart().startsWith('|')) break
    tableLines.push(line)
  }

  if (tableLines.length < 2 || !/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(tableLines[1] || '')) {
    return null
  }

  return tableLines.join('\n')
}

function readDefinitionListBlock(src: string) {
  const lines = src.split('\n')
  const dlLines: string[] = []

  for (const line of lines) {
    if (!line.trim()) {
      if (dlLines.length > 0) break
      return null
    }
    if (!/^[;:][ \t]+/.test(line)) break
    dlLines.push(line)
  }

  return dlLines.length > 0 ? dlLines.join('\n') : null
}

function readDetailsBlock(src: string) {
  const match = src.match(/^<details\b[\s\S]*?<\/details>/i)
  return match?.[0] || null
}

function readHtmlCommentBlock(src: string) {
  const match = src.match(/^<!--[\s\S]*?-->/)
  return match?.[0] || null
}

function findBlockStart(src: string, pattern: RegExp) {
  const match = pattern.exec(src)
  return match?.index ?? -1
}

function readRawBlock(src: string) {
  if (src.startsWith(':ImageUploader')) {
    return src.match(/^:ImageUploader[ \t]*(?:\n|$)/)?.[0].trimEnd() || null
  }

  if (src.startsWith('<!--')) {
    return readHtmlCommentBlock(src)
  }

  if (src.startsWith('::')) {
    return readFenceBlock(src)
  }

  if (src.startsWith('|')) {
    return readTableBlock(src)
  }

  if (/^<details\b/i.test(src)) {
    return readDetailsBlock(src)
  }

  return null
}

export const WikiRawBlock = Node.create({
  name: 'wikiRawBlock',
  priority: 800,
  group: 'block',
  atom: true,
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      raw: { default: '' },
      label: { default: 'Wiki 拡張構文' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-wiki-raw-block]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false
          return {
            raw: element.dataset.raw || '',
            label: element.dataset.label || 'Wiki 拡張構文'
          }
        }
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-raw-block': '',
        'data-raw': node.attrs.raw,
        'data-label': node.attrs.label,
        contenteditable: 'false',
        class: 'wiki-raw-block'
      }),
      ['span', { class: 'wiki-raw-block__label' }, node.attrs.label],
      ['code', { class: 'wiki-raw-block__code' }, node.attrs.raw]
    ]
  },

  markdownTokenizer: {
    name: 'wikiRawBlock',
    level: 'block',
    start(src) {
      const candidates = [
        findBlockStart(src, /^:ImageUploader\b/m),
        findBlockStart(src, /^<!--/m),
        findBlockStart(src, /^::[A-Za-z][\w-]*/m),
        findBlockStart(src, /^\|/m),
        findBlockStart(src, /^<details\b/im)
      ].filter((index) => index >= 0)
      return candidates.length > 0 ? Math.min(...candidates) : -1
    },
    tokenize(src) {
      const raw = readRawBlock(src)
      if (!raw) return undefined

      return {
        type: 'wikiRawBlock',
        raw,
        text: raw,
        label: classifyRawBlock(raw)
      }
    }
  },

  parseMarkdown: (token, helpers) => {
    const raw = getRaw(token)
    return helpers.createNode('wikiRawBlock', {
      raw,
      label: String(token.label || classifyRawBlock(raw))
    })
  },

  renderMarkdown: (node: JSONContent) => {
    return String(node.attrs?.raw || '')
  }
})

export const WikiDefinitionItem = Node.create({
  name: 'wikiDefinitionItem',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      kind: { default: 'dd' }
    }
  },

  parseHTML() {
    return [
      { tag: 'dt', getAttrs: () => ({ kind: 'dt' }) },
      { tag: 'dd', getAttrs: () => ({ kind: 'dd' }) }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [node.attrs.kind === 'dt' ? 'dt' : 'dd', HTMLAttributes, 0]
  },

  renderMarkdown: (node, helpers) => {
    const prefix = node.attrs?.kind === 'dt' ? '; ' : ': '
    return `${prefix}${helpers.renderChildren(node.content || [])}`
  }
})

export const WikiDefinitionList = Node.create({
  name: 'wikiDefinitionList',
  priority: 1000,
  group: 'block',
  content: 'wikiDefinitionItem+',

  parseHTML() {
    return [{ tag: 'dl' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['dl', mergeAttributes(HTMLAttributes, { class: 'wiki-definition-list' }), 0]
  },

  markdownTokenizer: {
    name: 'wikiDefinitionList',
    level: 'block',
    start(src) {
      const index = src.search(/^[;:][ \t]+/m)
      return index >= 0 ? index : -1
    },
    tokenize(src, _tokens, lexer) {
      const raw = readDefinitionListBlock(src)
      if (!raw) return undefined

      const definitionItems = raw.split('\n').map((line) => {
        const kind = line.startsWith(';') ? 'dt' : 'dd'
        const text = line.replace(/^[;:][ \t]+/, '')
        return {
          kind,
          text,
          tokens: lexer.inlineTokens(text)
        }
      })

      return {
        type: 'wikiDefinitionList',
        raw,
        definitionItems
      }
    }
  },

  parseMarkdown: (token, helpers) => {
    const definitionItems = (token.definitionItems || []) as Array<{
      kind: 'dt' | 'dd'
      tokens: MarkdownToken[]
    }>

    return helpers.createNode(
      'wikiDefinitionList',
      {},
      definitionItems.map((item) =>
        helpers.createNode('wikiDefinitionItem', { kind: item.kind }, helpers.parseInline(item.tokens || []))
      )
    )
  },

  renderMarkdown: (node, helpers) => {
    return (node.content || [])
      .map((item) => {
        const prefix = item.attrs?.kind === 'dt' ? '; ' : ': '
        return `${prefix}${helpers.renderChildren(item.content || [])}`
      })
      .join('\n')
  }
})

export const WikiAttribute = Mark.create({
  name: 'wikiAttribute',

  addAttributes() {
    return {
      rawAttrs: { default: '' }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-attrs]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false
          return {
            rawAttrs: element.dataset.wikiAttrs || ''
          }
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { rawAttrs, ...attrs } = HTMLAttributes
    return ['span', mergeAttributes(attrs, parseInlineAttrs(rawAttrs || ''), { 'data-wiki-attrs': rawAttrs }), 0]
  },

  markdownTokenizer: {
    name: 'wikiAttribute',
    level: 'inline',
    start(src) {
      return src.indexOf(']{')
    },
    tokenize(src, _tokens, lexer) {
      const match = src.match(/^\[([^\]\n]+)\]\{([^}\n]+)\}/)
      if (!match) return undefined

      const [, text = '', rawAttrs = ''] = match
      return {
        type: 'wikiAttribute',
        raw: match[0],
        text,
        rawAttrs,
        tokens: lexer.inlineTokens(text)
      }
    }
  },

  parseMarkdown: (token, helpers) => {
    return helpers.applyMark('wikiAttribute', helpers.parseInline(token.tokens || []), {
      rawAttrs: String(token.rawAttrs || '')
    })
  },

  renderMarkdown: (node, helpers) => {
    return `[${helpers.renderChildren(node)}]{${node.attrs?.rawAttrs || ''}}`
  }
})

export const wikiMarkdownExtensions = [
  TaskList,
  TaskItem.configure({ nested: true }),
  WikiDefinitionItem,
  WikiDefinitionList,
  WikiRawBlock,
  WikiAttribute
]
