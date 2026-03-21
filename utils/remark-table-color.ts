import { visit } from 'unist-util-visit'

export default function remarkTableColor() {
  return (tree: any) => {
    visit(tree, 'tableCell', (node: any) => {
      if (!node.children || node.children.length === 0) return
      
      const firstChild = node.children[0]
      // 最初のノードがテキストノードの場合に色指定構文がないかチェック
      if (firstChild.type === 'text' && firstChild.value) {
        // 先頭が @色名: で始まるかチェック
        const match = firstChild.value.match(/^@([A-Za-z0-9#-]+):(.*)/s)
        
        if (match) {
          const color = match[1]
          const remainingText = match[2]
          
          // hProperties に background-color スタイルを追加
          node.data = node.data || {}
          node.data.hProperties = node.data.hProperties || {}
          
          const currentStyle = node.data.hProperties.style || ''
          node.data.hProperties.style = `${currentStyle ? currentStyle + ';' : ''}background-color: ${color};`
          
          // 文字列の更新または削除
          if (remainingText.length > 0) {
            // 色指定部分だけを消したテキストを残す
            firstChild.value = remainingText
          } else {
            // 「@#ffff77:」などでマッチし、自身のテキストが空になる場合はそのノード自体を削除
            // （直後に続く [リンク] 等の別ノードだけがそのまま展開されるようにする）
            node.children.shift()
          }
        }
      }
    })
  }
}
