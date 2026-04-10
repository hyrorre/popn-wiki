import { visit } from 'unist-util-visit'
import type { Root, TableCell, Text } from 'mdast'

interface CustomData {
  hProperties?: Record<string, boolean | number | string | null | undefined | Array<string | number>>
  [key: string]: unknown
}

interface CustomTableCell extends TableCell {
  data?: CustomData
}

export default function remarkTableColor() {
  return (tree: Root) => {
    visit(tree, 'tableCell', (node: TableCell) => {
      const customNode = node as CustomTableCell
      if (!customNode.children || customNode.children.length === 0) return

      const firstChild = customNode.children[0]
      if (!firstChild) return

      // 最初のノードがテキストノードの場合に色指定構文がないかチェック
      if (firstChild.type === 'text' && (firstChild as Text).value) {
        const textNode = firstChild as Text
        // 先頭が @色名: で始まるかチェック
        const match = textNode.value.match(/^@([A-Za-z0-9#-]+):(.*)/s)

        if (match) {
          const color = match[1]
          const remainingText = match[2]

          if (color && remainingText !== undefined) {
            // hProperties に background-color スタイルを追加
            customNode.data = customNode.data || {}
            customNode.data.hProperties = customNode.data.hProperties || {}

            const currentStyleValue = customNode.data.hProperties.style
            const currentStyle: string = typeof currentStyleValue === 'string' ? currentStyleValue : ''
            customNode.data.hProperties.style = `${currentStyle ? currentStyle + ';' : ''}background-color: ${color};`

            // 文字列の更新または削除
            if (remainingText.length > 0) {
              // 色指定部分だけを消したテキストを残す
              textNode.value = remainingText
            } else {
              // 「@#ffff77:」などでマッチし、自身のテキストが空になる場合はそのノード自体を削除
              // （直後に続く [リンク] 等の別ノードだけがそのまま展開されるようにする）
              customNode.children.shift()
            }
          }
        }
      }
    })
  }
}
