import { describe, expect, test } from 'bun:test'
import type { MDCElement, MDCNode } from '@nuxtjs/mdc'
import { parseSafeMarkdown } from '../server/utils/markdown'

function spans(nodes: MDCNode[]): MDCElement[] {
  return nodes.flatMap((node) =>
    node.type === 'element' ? [...(node.tag === 'span' ? [node] : []), ...spans(node.children)] : []
  )
}

// Bun runs without Nuxt, so these checks cover the server parse options on their own.
describe('Inline text colors', () => {
  test('turns the toolbar color syntax into styles when parsing outside Nuxt', async () => {
    const { ast } = await parseSafeMarkdown('[赤]{color="red"} と [背景]{bg-color="#ff0"}')
    const [red, background] = spans(ast.body.children)

    expect(red?.props?.style).toBe('color: red')
    expect(background?.props?.style).toBe('background-color: #ff0')
  })

  test('ignores color values outside the allowed pattern', async () => {
    const { ast } = await parseSafeMarkdown('[危険]{color="url(https://example.com/x)"}')

    expect(spans(ast.body.children)[0]?.props?.style).toBeUndefined()
  })
})
