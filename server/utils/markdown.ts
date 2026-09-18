import type { MDCParseOptions } from '@nuxtjs/mdc'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import remarkBreaks from 'remark-breaks'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { parseFrontMatter } from 'remark-mdc'
import { visit } from 'unist-util-visit'
import remarkLegacyUrl from '~/utils/remark-legacy-url'
import remarkTableMerge from '~/utils/remark-table-merge'
import remarkTableColor from '~/utils/remark-table-color'
import remarkDefinitionList from '~/utils/remark-definition-list'
import rehypeLegacyUrl from '~/utils/rehype-legacy-url'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeSecurity from '~/utils/rehype-security'
import {
  MARKDOWN_RENDER_VERSION,
  MARKDOWN_TABLE_LAYOUT_VERSION,
  sanitizeMdcParserResult
} from '~/utils/markdown-security'

export const mdcParseOptions: MDCParseOptions = {
  remark: {
    plugins: {
      breaks: { instance: remarkBreaks },
      remarkLegacyUrl: { instance: remarkLegacyUrl },
      tableMerge: { instance: remarkTableMerge },
      tableColor: { instance: remarkTableColor },
      definitionList: { instance: remarkDefinitionList }
    }
  },
  rehype: {
    plugins: {
      rehypeLegacyUrl: { instance: rehypeLegacyUrl },
      rehypeSecurity: { instance: rehypeSecurity },
      rehypeExternalLinks: {
        instance: rehypeExternalLinks,
        options: { target: '_blank', rel: ['noopener', 'noreferrer'] }
      }
    }
  }
}

export async function parseSafeMarkdown(markdown: string) {
  const sanitizedMarkdown = sanitizeDangerousMarkdownHtml(markdown)
  const ast = {
    ...sanitizeMdcParserResult(await parseMarkdown(sanitizedMarkdown, mdcParseOptions)),
    tableLayoutVersion: MARKDOWN_TABLE_LAYOUT_VERSION,
    renderVersion: MARKDOWN_RENDER_VERSION
  }

  return { sanitizedMarkdown, ast }
}

const BLOCKED_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'form', 'base', 'link', 'meta', 'style'])

type BlockedTag = {
  start: number
  end: number
  name: string
  closing: boolean
  selfClosing: boolean
}

const htmlSourceParser = unified().use(remarkParse)

export function sanitizeDangerousMarkdownHtml(markdown: string) {
  const { content } = parseFrontMatter(markdown)
  const contentOffset = markdown.length - content.length
  const tree = htmlSourceParser.parse(content)
  let result = ''
  let cursor = 0

  // Only edit actual HTML nodes. Code, escaped text and link titles are literal content.
  const ranges: Array<{ start: number; end: number }> = []
  visit(tree, 'html', (node) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start !== undefined && end !== undefined)
      ranges.push({ start: start + contentOffset, end: end + contentOffset })
  })

  for (let index = 0; index < ranges.length; index++) {
    const range = ranges[index]!
    let end = range.end
    const fragment = markdown.slice(range.start, end)
    const opening = readBlockedTag(fragment, 0)
    // Inline HTML has separate opening/closing nodes. Remove the unsafe element's
    // contents too, but only recognize closing tags parsed as real HTML.
    if (opening && !opening.closing && !opening.selfClosing && opening.end === fragment.length - 1) {
      const closingIndex = ranges.findIndex((candidate, candidateIndex) => {
        if (candidateIndex <= index) return false
        const tag = readBlockedTag(markdown.slice(candidate.start, candidate.end), 0)
        return tag?.closing && tag.name === opening.name
      })
      if (closingIndex !== -1) {
        end = ranges[closingIndex]!.end
        index = closingIndex
      }
    }
    result += markdown.slice(cursor, range.start)
    result += stripDangerousAttributes(removeBlockedTags(markdown.slice(range.start, end)))
    cursor = end
  }

  return result + markdown.slice(cursor)
}

function removeBlockedTags(markdown: string) {
  let result = ''
  let cursor = 0

  while (cursor < markdown.length) {
    const tag = findNextBlockedTag(markdown, cursor)

    if (!tag) {
      result += markdown.slice(cursor)
      break
    }

    result += markdown.slice(cursor, tag.start)

    if (tag.closing || tag.selfClosing) {
      cursor = tag.end + 1
      continue
    }

    const closingTag = findClosingTag(markdown, tag.name, tag.end + 1)
    cursor = closingTag ? closingTag.end + 1 : tag.end + 1
  }

  return result
}

function stripDangerousAttributes(markdown: string) {
  let result = ''
  let cursor = 0

  while (cursor < markdown.length) {
    const tagStart = markdown.indexOf('<', cursor)
    if (tagStart === -1) {
      result += markdown.slice(cursor)
      break
    }

    result += markdown.slice(cursor, tagStart)

    const tagEnd = findTagEnd(markdown, tagStart)
    if (tagEnd === -1) {
      result += markdown.slice(tagStart)
      break
    }

    result += sanitizeTagAttributes(markdown.slice(tagStart, tagEnd + 1))
    cursor = tagEnd + 1
  }

  return result
}

function sanitizeTagAttributes(tag: string): string {
  return tag
    .replace(/\s+on[a-z]\w*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"'/]+)/gi, '')
    .replace(
      /\s+(?:href|src|action|formaction|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>"'/]*)/gi,
      ''
    )
}

function findNextBlockedTag(markdown: string, from: number) {
  let index = from

  while (index < markdown.length) {
    const start = markdown.indexOf('<', index)
    if (start === -1) return null

    const tag = readBlockedTag(markdown, start)
    if (tag) return tag

    index = start + 1
  }

  return null
}

function findClosingTag(markdown: string, tagName: string, from: number) {
  let index = from

  while (index < markdown.length) {
    const start = markdown.indexOf('<', index)
    if (start === -1) return null

    const tag = readBlockedTag(markdown, start)
    if (tag?.closing && tag.name === tagName) return tag

    index = start + 1
  }

  return null
}

function readBlockedTag(markdown: string, start: number): BlockedTag | null {
  const end = findTagEnd(markdown, start)
  if (end === -1) return null

  let cursor = start + 1
  cursor = skipSpaces(markdown, cursor)
  const closing = markdown[cursor] === '/'
  if (closing) {
    cursor = skipSpaces(markdown, cursor + 1)
  }

  const nameStart = cursor
  while (cursor < markdown.length && /[A-Za-z0-9-]/.test(markdown[cursor] ?? '')) {
    cursor++
  }

  const name = markdown.slice(nameStart, cursor).toLowerCase()
  if (!BLOCKED_TAGS.has(name)) {
    return null
  }

  const delimiter = markdown[cursor]
  if (delimiter && !/\s|\/|>/.test(delimiter)) {
    return null
  }

  return {
    start,
    end,
    name,
    closing,
    selfClosing: isSelfClosingTag(markdown, start, end)
  }
}

function findTagEnd(markdown: string, start: number) {
  let quote: '"' | "'" | null = null

  for (let index = start + 1; index < markdown.length; index++) {
    const char = markdown[index]
    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '>') {
      return index
    }
  }

  return -1
}

function isSelfClosingTag(markdown: string, start: number, end: number) {
  let cursor = end - 1
  while (cursor > start && /\s/.test(markdown[cursor] ?? '')) {
    cursor--
  }
  return markdown[cursor] === '/'
}

function skipSpaces(markdown: string, cursor: number) {
  while (cursor < markdown.length && /\s/.test(markdown[cursor] ?? '')) {
    cursor++
  }
  return cursor
}
