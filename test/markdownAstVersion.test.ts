import { describe, expect, test } from 'bun:test'
import { isMarkdownAstOutdated } from '../server/utils/markdown'
import { MARKDOWN_RENDER_VERSION, MARKDOWN_TABLE_LAYOUT_VERSION } from '../utils/markdown-security'

const storedAst = (versions: Record<string, unknown>) =>
  JSON.stringify({ body: { type: 'root', children: [] }, data: {}, ...versions })

describe('Stored Markdown AST version', () => {
  test('treats missing or unreadable ASTs as outdated', () => {
    expect(isMarkdownAstOutdated(null)).toBe(true)
    expect(isMarkdownAstOutdated(undefined)).toBe(true)
    expect(isMarkdownAstOutdated('')).toBe(true)
    expect(isMarkdownAstOutdated('{')).toBe(true)
    expect(isMarkdownAstOutdated('null')).toBe(true)
    expect(isMarkdownAstOutdated('1')).toBe(true)
  })

  test('treats ASTs saved before the current render and table layout versions as outdated', () => {
    expect(isMarkdownAstOutdated(storedAst({}))).toBe(true)
    expect(
      isMarkdownAstOutdated(
        storedAst({ renderVersion: MARKDOWN_RENDER_VERSION - 1, tableLayoutVersion: MARKDOWN_TABLE_LAYOUT_VERSION })
      )
    ).toBe(true)
    expect(isMarkdownAstOutdated(storedAst({ renderVersion: MARKDOWN_RENDER_VERSION }))).toBe(true)
    expect(
      isMarkdownAstOutdated(
        storedAst({ renderVersion: String(MARKDOWN_RENDER_VERSION), tableLayoutVersion: MARKDOWN_TABLE_LAYOUT_VERSION })
      )
    ).toBe(true)
  })

  test('keeps current and newer ASTs so mixed deployments do not overwrite each other', () => {
    expect(
      isMarkdownAstOutdated(
        storedAst({ renderVersion: MARKDOWN_RENDER_VERSION, tableLayoutVersion: MARKDOWN_TABLE_LAYOUT_VERSION })
      )
    ).toBe(false)
    expect(
      isMarkdownAstOutdated(
        storedAst({ renderVersion: MARKDOWN_RENDER_VERSION + 1, tableLayoutVersion: MARKDOWN_TABLE_LAYOUT_VERSION })
      )
    ).toBe(false)
  })
})
