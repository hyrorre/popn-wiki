import type { MDCElement, MDCNode, MDCParserResult, MDCRoot } from '@nuxtjs/mdc'

export const MARKDOWN_TABLE_LAYOUT_VERSION = 1
export const MARKDOWN_RENDER_VERSION = 3

type HastNode = {
  type?: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const SAFE_HTML_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'input',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'var',
  'wbr'
])

const SAFE_MDC_COMPONENTS = new Set([
  'accordion',
  'accordion-item',
  'badge',
  'callout',
  'card',
  'card-group',
  'caution',
  'code-collapse',
  'code-group',
  'code-icon',
  'code-preview',
  'code-tree',
  'collapsible',
  'component-slot',
  'field',
  'field-group',
  'icon',
  'id-generator',
  'image-list',
  'image-uploader',
  'note',
  'prompt',
  'recent-comments',
  'recent-edits',
  'sortable',
  'steps',
  'tabs',
  'tabs-item',
  'tip',
  'warning'
])

const DROP_WITH_CONTENT_TAGS = new Set([
  'applet',
  'base',
  'embed',
  'form',
  'frame',
  'frameset',
  'iframe',
  'link',
  'math',
  'meta',
  'noscript',
  'object',
  'script',
  'style',
  'svg'
])

const URL_PROPERTIES = new Set([
  'action',
  'cite',
  'formaction',
  'href',
  'legacyhref',
  'poster',
  'src',
  'to',
  'xlinkhref'
])

const BLOCKED_PROPERTIES = new Set(['as', 'innerhtml', 'is', 'outerhtml', 'srcdoc', 'xmlns'])

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_COLOR_PATTERN = /^(?:[a-zA-Z]+|#[0-9a-fA-F]{3,8}|rgba?\(\s*[0-9.%\s,]+\)|hsla?\(\s*[0-9.%\s,]+\))$/

export function sanitizeHastTree(tree: HastNode, file?: { data?: Record<string, unknown> }) {
  tree.children = sanitizeHastChildren(tree.children ?? [], sanitizeMdcMetadata(file?.data))
  return tree
}

export function sanitizeMdcParserResult(result: MDCParserResult): MDCParserResult {
  const data = sanitizeMdcMetadata(result.data)
  return {
    ...result,
    data,
    body: sanitizeMdcRoot(result.body, data),
    ...(result.excerpt ? { excerpt: sanitizeMdcRoot(result.excerpt, data) } : {})
  }
}

// Frontmatter must not choose renderer components or bypass sanitized node props.
export function sanitizeMdcMetadata(data: Record<string, unknown> | undefined): MDCParserResult['data'] {
  return {
    ...Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => key !== 'component' && key !== 'mdc')),
    title: typeof data?.title === 'string' ? data.title : '',
    description: typeof data?.description === 'string' ? data.description : ''
  }
}

export function sanitizeUnknownMdcMetadata(value: unknown): MDCParserResult['data'] {
  return sanitizeMdcMetadata(isRecord(value) && isRecord(value.data) ? value.data : undefined)
}

export function sanitizeUnknownMdcDocument(value: unknown): MDCParserResult | null {
  if (!isRecord(value) || !isRecord(value.body) || value.body.type !== 'root') {
    return null
  }

  // Unknown older transforms may have removed components or their content irreversibly.
  if (value.renderVersion !== MARKDOWN_RENDER_VERSION) return null

  const result = value as unknown as MDCParserResult
  // Older stored ASTs may already have lost the styles that hide merged cells.
  // Return null so existing callers render the original Markdown instead.
  if (value.tableLayoutVersion !== MARKDOWN_TABLE_LAYOUT_VERSION && containsTable(result.body.children)) {
    return null
  }
  return sanitizeMdcParserResult(result)
}

function containsTable(children: MDCNode[]): boolean {
  return (
    Array.isArray(children) &&
    children.some(
      (child) => child.type === 'element' && (child.tag.toLowerCase() === 'table' || containsTable(child.children))
    )
  )
}

export function sanitizeLinkTarget(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = removeUrlControlCharacters(decodeHtmlCharacterReferences(trimmed))
  const scheme = normalized.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase()

  if (scheme && !SAFE_URL_PROTOCOLS.has(`${scheme}:`)) {
    return null
  }

  return trimmed
}

function sanitizeHastChildren(children: HastNode[], data: Record<string, unknown>): HastNode[] {
  return children.flatMap((child) => {
    if (child.type !== 'element' || !child.tagName) {
      return [child]
    }

    const tag = child.tagName.toLowerCase()
    if (tag === 'binding') {
      return [{ type: 'text', value: resolveTextBinding(child.properties, data) }]
    }
    if (DROP_WITH_CONTENT_TAGS.has(tag)) {
      return []
    }

    child.children = sanitizeHastChildren(child.children ?? [], data)
    if (!isSafeTag(tag)) {
      return child.children
    }

    child.tagName = tag
    child.properties = sanitizeProperties(tag, child.properties)
    return [child]
  })
}

export function sanitizeMdcRoot(root: MDCRoot, metadata?: Record<string, unknown>): MDCRoot {
  return {
    ...root,
    type: 'root',
    children: sanitizeMdcChildren(Array.isArray(root.children) ? root.children : [], sanitizeMdcMetadata(metadata))
  }
}

function sanitizeMdcChildren(children: MDCNode[], data: Record<string, unknown>): MDCNode[] {
  return children.flatMap((child) => {
    if (child.type !== 'element') {
      return [child]
    }

    const tag = child.tag.toLowerCase()
    if (tag === 'binding') {
      return [{ type: 'text', value: resolveTextBinding(child.props, data) }]
    }
    if (DROP_WITH_CONTENT_TAGS.has(tag)) {
      return []
    }

    const sanitizedChildren = sanitizeMdcChildren(Array.isArray(child.children) ? child.children : [], data)
    if (!isSafeTag(tag)) {
      return sanitizedChildren
    }

    const sanitized: MDCElement = {
      ...child,
      tag,
      props: sanitizeProperties(tag, child.props),
      children: sanitizedChildren
    }
    return [sanitized]
  })
}

function resolveTextBinding(properties: Record<string, unknown> | undefined, data: Record<string, unknown>) {
  if (typeof properties?.value !== 'string') return ''
  const path = properties.value
    .trim()
    .replace(/^\$(?:doc|document)\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
  if (!/^[A-Za-z_][\w-]*(?:\.[\w-]+)*$/.test(path)) return ''
  let value: unknown = data
  for (const key of path.split('.')) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) return ''
    if (!isRecord(value)) {
      value = undefined
      break
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    // Read JSON data only: no prototype traversal, getters or function invocation.
    value = descriptor && 'value' in descriptor ? descriptor.value : undefined
  }
  value ??= properties.defaultValue
  return typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
    ? String(value)
    : ''
}

function isSafeTag(tag: string) {
  return SAFE_HTML_TAGS.has(tag) || SAFE_MDC_COMPONENTS.has(tag)
}

function sanitizeProperties(tag: string, properties: Record<string, unknown> | null | undefined) {
  const sanitized: Record<string, unknown> = {}

  for (const [name, value] of Object.entries(properties ?? {})) {
    const normalizedName = normalizePropertyName(name)

    if (tag === 'template' || tag === 'component-slot') {
      if (/^v-slot:[A-Za-z][\w-]*$/.test(name) && (value === '' || value === true)) {
        sanitized[name] = value
      }
      continue
    }

    if (isBlockedProperty(name, normalizedName)) continue

    if (URL_PROPERTIES.has(normalizedName)) {
      const safeValue = sanitizeLinkTarget(value)
      if (safeValue !== null) sanitized[name] = safeValue
      continue
    }

    if (normalizedName === 'style') {
      const safeStyle = sanitizeStyle(tag, value)
      if (safeStyle) sanitized[name] = safeStyle
      continue
    }

    sanitized[name] = value
  }

  if (tag === 'input') {
    if (sanitized.type !== 'checkbox') return {}
    return {
      type: 'checkbox',
      checked: sanitized.checked === true,
      disabled: true
    }
  }

  return sanitized
}

function isBlockedProperty(name: string, normalizedName: string) {
  const lowerName = name.toLowerCase()
  return (
    lowerName.startsWith('@') ||
    lowerName.startsWith(':') ||
    lowerName.startsWith('v-') ||
    normalizedName.startsWith('on') ||
    BLOCKED_PROPERTIES.has(normalizedName)
  )
}

function normalizePropertyName(name: string) {
  return name.toLowerCase().replace(/[-_:]/g, '')
}

function sanitizeStyle(tag: string, value: unknown) {
  if (typeof value !== 'string') return ''

  const declarations = value.split(';').flatMap((declaration) => {
    const separator = declaration.indexOf(':')
    if (separator === -1) return []

    const property = declaration.slice(0, separator).trim().toLowerCase()
    const styleValue = declaration.slice(separator + 1).trim()
    if ((property === 'color' || property === 'background-color') && SAFE_COLOR_PATTERN.test(styleValue)) {
      return [`${property}: ${styleValue}`]
    }

    // Shiki's CSS is supplied by the application; only its bounded token values survive.
    if ((tag === 'span' || tag === 'pre') && isSafeHighlightStyle(property, styleValue)) {
      return [`${property}: ${styleValue}`]
    }

    if (tag === 'td' || tag === 'th') {
      const keyword = styleValue.toLowerCase()
      if (
        (property === 'display' && keyword === 'none') ||
        (property === 'text-align' && /^(left|center|right)$/.test(keyword)) ||
        (property === 'vertical-align' && /^(top|middle|bottom)$/.test(keyword))
      ) {
        return [`${property}: ${keyword}`]
      }
    }

    return []
  })

  return declarations.join('; ')
}

function isSafeHighlightStyle(property: string, value: string) {
  const match = property.match(/^--shiki-(?:light|default|dark)(-bg|-font-style|-font-weight|-text-decoration)?$/)
  if (!match) return false
  switch (match[1]) {
    case '-font-style':
      return /^(normal|italic|oblique)$/.test(value)
    case '-font-weight':
      return /^(normal|bold|[1-9]00)$/.test(value)
    case '-text-decoration':
      return /^(none|underline|line-through)$/.test(value)
    default:
      return SAFE_COLOR_PATTERN.test(value)
  }
}

function decodeHtmlCharacterReferences(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, code: string) => safeCodePoint(code, 16))
    .replace(/&#(\d+);?/g, (_, code: string) => safeCodePoint(code, 10))
    .replace(/&colon;?/gi, ':')
    .replace(/&tab;?/gi, '\t')
    .replace(/&newline;?/gi, '\n')
}

function removeUrlControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 32 && (codePoint < 127 || codePoint > 159)
    })
    .join('')
}

function safeCodePoint(value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix)
  return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
