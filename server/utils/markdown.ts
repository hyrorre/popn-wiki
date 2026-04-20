type BlockedTag = {
  start: number
  end: number
  name: string
  closing: boolean
  selfClosing: boolean
}

export function sanitizeDangerousMarkdownHtml(markdown: string) {
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
  if (name !== 'script' && name !== 'iframe') {
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
  let quote: '"' | '\'' | null = null

  for (let index = start + 1; index < markdown.length; index++) {
    const char = markdown[index]
    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === '\'') {
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
