import { describe, expect, test } from 'bun:test'

async function loadSeedTask() {
  Object.assign(globalThis, {
    defineTask: (task: unknown) => task
  })

  return await import('../server/tasks/seed')
}

describe('DokuWiki table seed conversion', () => {
  test('normalizes mixed header delimiters to the widest row', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '^INITIAL^TITLE^CHARACTER|^BPM|^ASSIGN|^',
        '^STATE^ARTIST^[illust type]^[anime ver.]^E^N^H^EX^',
        '|A|Angelic Jelly|Poet||200||OK||'
      ].join('\n')
    )

    expect(markdown).toContain('| INITIAL | TITLE | CHARACTER | > | BPM | > | ASSIGN | > |')
    expect(markdown).toContain('| --- | --- | --- | --- | --- | --- | --- | --- |')
    expect(markdown).toContain('| A | Angelic Jelly | Poet | > | 200 | > | OK | > |')
  })

  test('does not split cells at link or media label separators', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '^Title^Image^Note^',
        '|[[https://example.com/page|Example]]|{{cover.png|Cover art}}|done|'
      ].join('\n')
    )

    expect(markdown).toContain('| Title | Image | Note |')
    expect(markdown).toContain('| [Example](https://example.com/page) | [Cover art](/cover.png) | done |')
  })

  test('does not split table cells at pipes inside comments', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['^A^B^C^', '|1/* | */|2|3|', '|4/*// | */|5|6|'].join('\n'))

    expect(markdown).toContain('| 1<!-- &#124; --> | 2 | 3 |')
    expect(markdown).toContain('| 4<!--// &#124; --> | 5 | 6 |')
  })
})

describe('DokuWiki list seed conversion', () => {
  test('removes the required DokuWiki list indent while preserving nesting', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['  * parent', '    * child', '      - ordered child'].join('\n'))

    expect(markdown).toContain(['* parent', '  * child', '    - ordered child'].join('\n'))
  })

  test('adds a space after list markers when DokuWiki text omits it', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['  *parent', '    -child'].join('\n'))

    expect(markdown).toContain(['* parent', '  - child'].join('\n'))
  })

  test('does not treat one-space indented bold text as a list item', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(' **心構え**')

    expect(markdown).toBe(' **心構え**')
  })

  test('moves comments out of list blocks before normalizing indentation', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * parent', '<!-- comment -->', '    * child', '      - ordered child'].join('\n')
    )

    expect(markdown).toContain(['<!-- comment -->', '* parent', '  * child', '    - ordered child'].join('\n'))
  })

  test('moves DokuWiki line comments out of list blocks', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['  * parent', '// comment', '    * child'].join('\n'))

    expect(markdown).toContain(['<!-- comment-->', '* parent', '  * child'].join('\n'))
  })

  test('moves comments before forced line breaks split list items', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '  * parent line 1\\\\ parent line 2',
        '<!-- comment -->',
        '    * child'
      ].join('\n')
    )

    expect(markdown).toContain(['<!-- comment -->', '* parent line 1', 'parent line 2', '  * child'].join('\n'))
  })
})

describe('DokuWiki bold link seed conversion', () => {
  test('moves bold markers inside Markdown links for MDC', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown('  * **[[その他:上達法指南のページ|上達法指南のページ]]**にも有力')

    expect(markdown).toBe('* [**上達法指南のページ**](/その他/上達法指南のページ)にも有力')
  })
})
