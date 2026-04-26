import { LEGACY_HREF_FALLBACK, isLegacyPercentEncodedUrl } from './legacy-url'

type MdastNode = {
  type?: string
  url?: string
  data?: {
    hProperties?: Record<string, unknown>
    [key: string]: unknown
  }
  children?: MdastNode[]
}

export default function remarkLegacyUrl() {
  return (tree: MdastNode) => {
    visit(tree)
  }
}

function visit(node: MdastNode) {
  if (node.type === 'link' && typeof node.url === 'string' && isLegacyPercentEncodedUrl(node.url)) {
    const legacyHref = node.url
    node.url = LEGACY_HREF_FALLBACK
    node.data = {
      ...node.data,
      hProperties: {
        ...node.data?.hProperties,
        legacyHref,
        rel: ['noopener', 'noreferrer'],
        target: '_blank'
      }
    }
  }

  for (const child of node.children ?? []) {
    visit(child)
  }
}
