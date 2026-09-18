import { visit } from 'unist-util-visit'
import type { Node, Parent } from 'unist'
import type { Root, Table, TableRow, TableCell, Text } from 'mdast'

interface CustomData {
  hProperties?: Record<string, boolean | number | string | null | undefined | Array<string | number>>
  [key: string]: unknown
}

interface CustomTableCell extends TableCell {
  data?: CustomData
}

interface GridCell {
  node: CustomTableCell
  row: number
  col: number
  colSpan: number
  rowSpan: number
  owner?: GridCell
  marker?: string
}

function getText(node: Node | Parent): string {
  if (!node) return ''
  if ('value' in node && typeof (node as Text).value === 'string') return (node as Text).value
  if ('children' in node && Array.isArray(node.children)) {
    return node.children
      .map((c) => getText(c as Node))
      .join('')
      .trim()
  }
  return ''
}

function findFirstText(node: Node | Parent): Text | null {
  if (node.type === 'text') return node as Text
  if ('children' in node) {
    for (const child of (node as Parent).children) {
      const found = findFirstText(child as Node)
      if (found) return found
    }
  }
  return null
}

function findLastText(node: Node | Parent): Text | null {
  if (node.type === 'text') return node as Text
  if ('children' in node) {
    const children = (node as Parent).children
    for (let i = children.length - 1; i >= 0; i--) {
      const found = findLastText(children[i] as Node)
      if (found) return found
    }
  }
  return null
}

// セルの先頭・末尾コロン記法を読み取り揃えを返し、マーカーをASTから除去する。
//   `:text`   → left
//   `text:`   → right  （`@` 始まりのセルは remark-table-color に委ねるため無視）
//   `:text:`  → center
//   記法なし  → null（呼び出し側がデフォルト値を決める）
//
// エスケープ: `::` で1個のリテラルコロンを表す（`\:` は remark パース時に消費される）
//   `::text`  → `:text` として出力、揃え指定なし
//   `text::`  → `text:` として出力、揃え指定なし
//
// 単純セル（Text1つ）で prefix/suffix が同一ノードの場合、prefix 処理後に
// suffix チェックが修正済みの value を参照するため `::` 単体も正しく `:` になる。
function extractAlignment(node: CustomTableCell): 'left' | 'right' | 'center' | null {
  const fullText = getText(node)
  const startsWithAt = fullText.startsWith('@')

  // `::` はエスケープ、単独 `:` のみ揃え記法とみなす
  const hasPrefix = fullText.startsWith(':') && !fullText.startsWith('::')
  const hasSuffix = !startsWithAt && fullText.endsWith(':') && !fullText.endsWith('::')
  const hasPrefixEscape = !hasPrefix && fullText.startsWith('::')
  const hasSuffixEscape = !hasSuffix && !startsWithAt && fullText.endsWith('::')

  if (hasPrefix) {
    const first = findFirstText(node)
    if (first?.value.startsWith(':')) first.value = first.value.slice(1)
  } else if (hasPrefixEscape) {
    const first = findFirstText(node)
    // 修正後の value を suffix チェックが参照するため slice(1) のみで十分
    if (first?.value.startsWith('::')) first.value = first.value.slice(1)
  }

  if (hasSuffix) {
    const last = findLastText(node)
    if (last?.value.endsWith(':')) last.value = last.value.slice(0, -1)
  } else if (hasSuffixEscape) {
    const last = findLastText(node)
    // prefix 処理後の value を参照するため `::` が残っている場合のみ strip
    if (last?.value.endsWith('::')) last.value = last.value.slice(0, -1)
  }

  if (hasPrefix && hasSuffix) return 'center'
  if (hasPrefix) return 'left'
  if (hasSuffix) return 'right'
  return null
}

export default function remarkTableMerge() {
  return (tree: Root) => {
    visit(tree, 'table', (tableNode: Table) => {
      const rows = tableNode.children || []

      // Keep the owning cell at every covered coordinate, including hidden placeholders.
      const grid: GridCell[][] = rows.map((row: TableRow, r) => {
        return (row.children || []).map((cell: TableCell, c) => ({
          node: cell as CustomTableCell,
          row: r,
          col: c,
          colSpan: 1,
          rowSpan: 1,
          marker:
            cell.children.length === 1 && cell.children[0]?.type === 'text' ? cell.children[0].value.trim() : undefined
        }))
      })

      // Process merges
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r]
        if (!row) continue
        for (let c = 0; c < row.length; c++) {
          const cell = row[c]
          if (!cell || cell.owner) continue

          if (cell.marker === '>') {
            const left = row[c - 1]
            const target = left?.owner ?? left
            // Do not extend a span originating on an earlier row into unrelated cells.
            if (target && target.row === r && target.marker !== '>' && target.marker !== '~') {
              target.colSpan++
              cell.owner = target
            }
          } else if (cell.marker === '~' && r > 1) {
            // HTML row spans cannot cross from thead into tbody.
            const above = grid[r - 1]?.[c]
            const target = above?.owner ?? above
            if (!target || target.col !== c || target.marker === '~' || target.marker === '>') continue
            const continuation = row.slice(c, c + target.colSpan)
            // A vertical continuation must cover the entire width of the same rectangle.
            // Both `~ | ~` and `~ | >` can continue a two-column merged cell.
            if (
              continuation.length === target.colSpan &&
              continuation.every((part, offset) => {
                const previous = grid[r - 1]?.[c + offset]
                return (
                  !part.owner &&
                  (part.marker === '~' || (offset > 0 && part.marker === '>')) &&
                  (previous?.owner ?? previous) === target
                )
              })
            ) {
              target.rowSpan++
              for (const part of continuation) part.owner = target
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

          if (info.owner) {
            // physics削除すると mdast-util-to-hast が勝手に空セルを足りない分補完してしまい
            // 逆にテーブルレイアウトが壊れるため、論理的に display: none とする
            node.data.hProperties.style = 'display: none;'
            // 中身のテキストも消しておく
            node.children = []
          } else {
            const alignment = extractAlignment(node)
            const styles: string[] = []

            if (info.colSpan > 1) {
              node.data.hProperties.colspan = info.colSpan
              // colspan のデフォルトは center（記法なしの既存挙動を維持）
              styles.push(`text-align: ${alignment ?? 'center'}`)
            } else if (alignment) {
              // 非結合セルは記法があるときのみ揃えを付与
              styles.push(`text-align: ${alignment}`)
            }

            if (info.rowSpan > 1) {
              node.data.hProperties.rowspan = info.rowSpan
              styles.push('vertical-align: middle')
            }

            if (styles.length > 0) {
              node.data.hProperties.style = styles.join('; ') + ';'
            }
          }
        }
      }
    })
  }
}
