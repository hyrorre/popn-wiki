import { LEGACY_HREF_FALLBACK, isLegacyPercentEncodedUrl } from './legacy-url'

type HastNode = {
  type?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

export default function rehypeLegacyUrl() {
  return (tree: HastNode) => {
    visit(tree)
  }
}

function visit(node: HastNode) {
  if (node.type === 'element' && node.tagName === 'a') {
    const href = node.properties?.href
    if (typeof href === 'string' && isLegacyPercentEncodedUrl(href)) {
      node.properties = {
        ...node.properties,
        href: LEGACY_HREF_FALLBACK,
        legacyHref: href,
        rel: ['noopener', 'noreferrer'],
        target: '_blank'
      }
    }
  }

  for (const child of node.children ?? []) {
    visit(child)
  }
}
