import { describe, expect, test } from 'bun:test'
import type { MDCElement, MDCNode } from '@nuxtjs/mdc'
import { parseSafeMarkdown } from '../server/utils/markdown'
import { sanitizeUnknownMdcDocument } from '../utils/markdown-security'

function cells(nodes: MDCNode[]): MDCElement[] {
  return nodes.flatMap((node) =>
    node.type === 'element' ? (node.tag === 'td' || node.tag === 'th' ? [node] : cells(node.children)) : []
  )
}

describe('safe Markdown table layout', () => {
  test.each(['~ | ~', '~ | >'])('merges rectangles with continuation row %s', async (continuation) => {
    const { ast } = await parseSafeMarkdown(
      [
        '| A | B | C |',
        '| --- | --- | --- |',
        '| @yellow:**Block** | > | One |',
        `| ${continuation} | Two |`,
        `| ${continuation} | Three |`
      ].join('\n')
    )
    const parsed = cells(ast.body.children)
    expect(Number(parsed[3]?.props?.colSpan)).toBe(2)
    expect(Number(parsed[3]?.props?.rowSpan)).toBe(3)
    expect(parsed[3]?.props?.style).toBe('text-align: center; vertical-align: middle; background-color: yellow')
    for (const index of [4, 6, 7, 9, 10]) {
      expect(parsed[index]?.props?.style).toBe('display: none')
      expect(parsed[index]?.children).toEqual([])
    }
    expect(parsed.slice(0, 3).every((cell) => !cell.props?.rowSpan)).toBe(true)
    expect(sanitizeUnknownMdcDocument(JSON.parse(JSON.stringify(ast)))?.body).toEqual(ast.body)
  })

  test('keeps invalid merges and code examples visible without crossing the header boundary', async () => {
    const { ast } = await parseSafeMarkdown(
      ['| A | B | C |', '| --- | --- | --- |', '| ~ | Literal | `>` |', '| > | `~` | End |'].join('\n')
    )
    const parsed = cells(ast.body.children)
    expect(parsed.every((cell) => !cell.props?.rowSpan && !cell.props?.colSpan && !cell.props?.style)).toBe(true)
    expect(parsed[3]?.children).toEqual([{ type: 'text', value: '~' }])
    expect(parsed[5]?.children[0]).toMatchObject({ type: 'element', tag: 'code' })
    expect(parsed[6]?.children).toEqual([{ type: 'text', value: '>' }])
    expect(parsed[7]?.children[0]).toMatchObject({ type: 'element', tag: 'code' })
  })

  test('keeps adjacent rectangles with different heights independent', async () => {
    const { ast } = await parseSafeMarkdown(
      [
        '| H1 | H2 | H3 | H4 |',
        '| --- | --- | --- | --- |',
        '| A | > | B | > |',
        '| ~ | > | ~ | ~ |',
        '| C | > | ~ | > |'
      ].join('\n')
    )
    const parsed = cells(ast.body.children)
    expect(Number(parsed[4]?.props?.rowSpan)).toBe(2)
    expect(Number(parsed[6]?.props?.rowSpan)).toBe(3)
    expect(Number(parsed[12]?.props?.colSpan)).toBe(2)
    expect(parsed[12]?.props?.rowSpan).toBeUndefined()
    const visible = parsed.slice(4).filter((cell) => cell.props?.style !== 'display: none')
    expect(visible.map((cell) => cell.children)).toEqual(['A', 'B', 'C'].map((value) => [{ type: 'text', value }]))
  })

  test('does not hide content when a vertical continuation covers only part of a wide cell', async () => {
    const { ast } = await parseSafeMarkdown('| A | B |\n| --- | --- |\n| Wide | > |\n| ~ | Keep me |')
    const parsed = cells(ast.body.children)
    expect(Number(parsed[2]?.props?.colSpan)).toBe(2)
    expect(parsed[2]?.props?.rowSpan).toBeUndefined()
    expect(parsed[4]?.children).toEqual([{ type: 'text', value: '~' }])
    expect(parsed[5]?.children).toEqual([{ type: 'text', value: 'Keep me' }])
  })

  test('preserves horizontal and vertical merges including consecutive markers', async () => {
    const { ast } = await parseSafeMarkdown(
      [
        '| Header | > | > |',
        '| --- | --- | --- |',
        '| Wide | > | > |',
        '| Tall | Other | Value |',
        '| ~ | Second | Value |',
        '| ~ | Third | Value |'
      ].join('\n')
    )
    const parsed = cells(ast.body.children)

    expect(Number(parsed[0]?.props?.colSpan)).toBe(3)
    expect(Number(parsed[3]?.props?.colSpan)).toBe(3)
    expect(Number(parsed[6]?.props?.rowSpan)).toBe(3)
    expect(parsed[3]?.props?.style).toBe('text-align: center')
    expect(parsed[6]?.props?.style).toBe('vertical-align: middle')
    for (const index of [1, 2, 4, 5, 9, 12]) {
      expect(parsed[index]?.props?.style).toBe('display: none')
      expect(parsed[index]?.children).toEqual([])
    }
    expect(sanitizeUnknownMdcDocument(JSON.parse(JSON.stringify(ast)))?.body).toEqual(ast.body)
  })

  test('preserves alignment and background colors alongside cell merging', async () => {
    const { ast } = await parseSafeMarkdown(
      ['| A | B | C |', '| --- | --- | --- |', '| : Left | > | Right: |', '| @#ffff77:Colored | > | :Center: |'].join(
        '\n'
      )
    )
    const parsed = cells(ast.body.children)
    expect(parsed[3]?.props?.style).toBe('text-align: left')
    expect(parsed[5]?.props?.style).toBe('text-align: right')
    expect(parsed[6]?.props?.style).toBe('text-align: center; background-color: #ffff77')
    expect(parsed[8]?.props?.style).toBe('text-align: center')
  })

  test('reparses stored tables whose layout styles may have been stripped', async () => {
    const { ast } = await parseSafeMarkdown('| A | B |\n| --- | --- |\n| Joined | > |')
    const legacy = JSON.parse(JSON.stringify(ast))
    delete legacy.tableLayoutVersion
    for (const cell of cells(legacy.body.children)) delete cell.props?.style

    expect(sanitizeUnknownMdcDocument(legacy)).toBeNull()
    expect(sanitizeUnknownMdcDocument({ ...legacy, tableLayoutVersion: 0 })).toBeNull()
    expect(sanitizeUnknownMdcDocument(ast)).not.toBeNull()

    const plain = (await parseSafeMarkdown('A document without tables')).ast
    expect(sanitizeUnknownMdcDocument({ ...plain, tableLayoutVersion: undefined })).not.toBeNull()
  })

  test('only allows fixed layout values and limits hiding to table cells', async () => {
    const { ast } = await parseSafeMarkdown(
      [
        '<div style="display:none; text-align:center; color:red; position:fixed">Visible</div>',
        '<table><tbody><tr>',
        '<td style="display:none; text-align:RIGHT; vertical-align:middle; position:fixed; background:url(https://example.com); width:expression(alert(1))">Hidden</td>',
        '<td style="display:block; text-align:expression(alert(1)); vertical-align:url(https://example.com); color:red">Safe</td>',
        '</tr></tbody></table>'
      ].join('\n')
    )
    const parsed = cells(ast.body.children)
    expect(parsed[0]?.props?.style).toBe('display: none; text-align: right; vertical-align: middle')
    expect(parsed[1]?.props?.style).toBe('color: red')
    const div = ast.body.children.find((node) => node.type === 'element' && node.tag === 'div') as MDCElement
    expect(div.props?.style).toBe('text-align: center; color: red')
  })
})
