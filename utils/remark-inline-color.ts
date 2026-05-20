import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'

interface CustomData {
  hProperties?: Record<string, boolean | number | string | null | undefined | Array<string | number>>
  [key: string]: unknown
}

interface TextComponentNode {
  type: 'textComponent'
  name?: string
  attributes?: Record<string, string>
  data?: CustomData
  children?: unknown[]
}

const COLOR_PATTERN = /^(?:[a-zA-Z]+|#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\))$/

export default function remarkInlineColor() {
  return (tree: Root) => {
    visit(tree, (node) => {
      const n = node as unknown as TextComponentNode
      if (n.type !== 'textComponent') return
      if (n.name !== 'span') return
      const attrs = n.attributes
      if (!attrs) return

      const color = attrs.color
      const bgColor = attrs['bg-color'] ?? attrs.bgColor
      const styles: string[] = []

      if (typeof color === 'string' && COLOR_PATTERN.test(color)) {
        styles.push(`color: ${color}`)
        delete attrs.color
      }
      if (typeof bgColor === 'string' && COLOR_PATTERN.test(bgColor)) {
        styles.push(`background-color: ${bgColor}`)
        delete attrs['bg-color']
        delete attrs.bgColor
      }

      if (styles.length === 0) return

      n.data = n.data || {}
      n.data.hProperties = n.data.hProperties || {}
      const current = n.data.hProperties.style
      const currentStr = typeof current === 'string' && current.length > 0 ? current + ';' : ''
      n.data.hProperties.style = currentStr + styles.join(';')
    })
  }
}
