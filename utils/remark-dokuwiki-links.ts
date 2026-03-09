import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

type Options = {
  /**
   * DokuWiki の内部リンクを URL に変換するときのベースパス
   * 例: [[page]] -> /wiki/page
   */
  basePath?: string
}

type TextNode = {
  type: 'text'
  value: string
}

type LinkNode = {
  type: 'link'
  url: string
  title: string | null
  children: TextNode[]
}

type ParentNode = {
  type: string
  children: Array<TextNode | LinkNode | ParentNode>
}

const remarkDokuWikiLinks: Plugin<[Options?]> = (options = {}) => {
  const basePath = options.basePath ?? ''

  return (tree) => {
    visit(tree, 'text', (node: TextNode, index: number | null, parent: ParentNode | null) => {
      if (!parent || index === null) {
        return
      }

      const value = node.value
      if (!value.includes('[[')) {
        return
      }

      const regex = /\[\[([^[\]|]+?)(?:\|([^[\]]+))?\]\]/g
      const newChildren: ParentNode['children'] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = regex.exec(value)) !== null) {
        const [full, targetRaw, labelRaw] = match
        const start = match.index
        const end = start + full.length

        if (start > lastIndex) {
          newChildren.push({
            type: 'text',
            value: value.slice(lastIndex, start)
          })
        }

        const target = targetRaw!.trim()
        const label = (labelRaw ?? targetRaw)!.trim()

        const isExternal = /^https?:\/\//i.test(target)
        const href = isExternal ? target : `${basePath}${target}`.replace(/\/{2,}/g, '/')

        const linkNode: LinkNode = {
          type: 'link',
          url: href,
          title: null,
          children: [
            {
              type: 'text',
              value: label
            }
          ]
        }

        newChildren.push(linkNode)
        lastIndex = end
      }

      if (lastIndex === 0) {
        // 変換対象がなかった
        return
      }

      if (lastIndex < value.length) {
        newChildren.push({
          type: 'text',
          value: value.slice(lastIndex)
        })
      }

      parent.children.splice(index, 1, ...newChildren)
    })
  }
}

export default remarkDokuWikiLinks
