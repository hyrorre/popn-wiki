import { visit } from 'unist-util-visit'
import type { Node, Parent } from 'unist'
import type { Root, Table, TableRow, TableCell, Text } from 'mdast'

interface CustomData {
  hProperties?: Record<string, boolean | number | string | null | undefined | Array<string | number>>;
  [key: string]: unknown;
}

interface CustomTableCell extends TableCell {
  data?: CustomData;
}

function getText(node: Node | Parent): string {
  if (!node) return ''
  if ('value' in node && typeof (node as Text).value === 'string') return (node as Text).value
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((c) => getText(c as Node)).join('').trim()
  }
  return ''
}

export default function remarkTableMerge() {
  return (tree: Root) => {
    visit(tree, 'table', (tableNode: Table) => {
      const rows = tableNode.children || []
      
      // grid: 2D array storing references and span information
      const grid = rows.map((row: TableRow) => {
        return (row.children || []).map((cell: TableCell) => ({
          node: cell as CustomTableCell,
          colSpan: 1,
          rowSpan: 1,
          deleted: false,
          text: getText(cell)
        }))
      })

      // Process merges
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r]
        if (!row) continue
        for (let c = 0; c < row.length; c++) {
          const cell = row[c]
          if (!cell) continue
          
          if (cell.text === '>') {
            let targetC = c - 1
            // 削除済みのセルをスキップして左の有効な結合先を探す
            while (targetC >= 0) {
              const targetCell = row[targetC]
              if (targetCell && targetCell.deleted) {
                targetC--
              } else {
                break
              }
            }
            if (targetC >= 0) {
              const targetCell = row[targetC]
              if (targetCell) {
                targetCell.colSpan += cell.colSpan
                cell.deleted = true
              }
            }
          } 
          else if (cell.text === '~') {
            let targetR = r - 1
            // 削除済みのセルをスキップして上の有効な結合先を探す
            while (targetR >= 0) {
              const targetRow = grid[targetR]
              const targetCell = targetRow ? targetRow[c] : undefined
              if (targetCell && targetCell.deleted) {
                targetR--
              } else {
                break
              }
            }
            if (targetR >= 0) {
              const targetRow = grid[targetR]
              const targetCell = targetRow ? targetRow[c] : undefined
              if (targetCell) {
                targetCell.rowSpan += cell.rowSpan
                cell.deleted = true
              }
            }
          }
        }
      }

      // Apply AST modifications
      for (let r = 0; r < rows.length; r++) {
        const rowInfo = grid[r]
        if (!rowInfo) continue
        
        for (let c = 0; c < rowInfo.length; c++) {
          const info = rowInfo[c]
          if (!info) continue
          const node = info.node
          node.data = node.data || {}
          node.data.hProperties = node.data.hProperties || {}
          
          if (info.deleted) {
            // physics削除すると mdast-util-to-hast が勝手に空セルを足りない分補完してしまい
            // 逆にテーブルレイアウトが壊れるため、論理的に display: none とする
            node.data.hProperties.style = 'display: none;'
            // 中身のテキストも消しておく
            node.children = []
          } else {
            if (info.colSpan > 1) {
              node.data.hProperties.colspan = info.colSpan
              node.data.hProperties.style = 'text-align: center;'
            }
            if (info.rowSpan > 1) {
              node.data.hProperties.rowspan = info.rowSpan
              node.data.hProperties.style = 'vertical-align: middle;'
            }
          }
        }
      }
    })
  }
}
