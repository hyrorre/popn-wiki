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
      ['^Title^Image^Note^', '|[[https://example.com/page|Example]]|{{cover.png|Cover art}}|done|'].join('\n')
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

  test('keeps malformed DokuWiki links from breaking table columns', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['^段位^曲^BPM^Lv^', '|4th|[[シューゲイザー|<span style="color: #FF0000">EX</span>|95~190|41|'].join('\n')
    )

    expect(markdown).toContain('| 段位 | 曲 | BPM | Lv |')
    expect(markdown).toContain(
      '| 4th | [[シューゲイザー&#124;<span style="color: #FF0000">EX</span>&#124;95~190&#124;41&#124; |  |  |'
    )
  })

  test('converts pipe-row blocks without an explicit DokuWiki header row', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['| A | B |', '| C | D |'].join('\n'))

    expect(markdown).toBe(['| A | B |', '| --- | --- |', '| C | D |'].join('\n'))
  })

  test('collapses multiline DokuWiki links before table parsing', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['^Tool^Note^', '|[[https://ssdh233.me/popn-sudden/|新筐体用', 'SUDDEN+数値計算ツール]]|スマホ向け|'].join('\n')
    )

    expect(markdown).toContain('| [新筐体用 SUDDEN+数値計算ツール](https://ssdh233.me/popn-sudden/) | スマホ向け |')
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

  test('moves multiline comments out of list blocks', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * parent', '<!--    * commented child', 'comment detail', '-->', '    * child'].join('\n')
    )

    expect(markdown).toContain(
      ['<!--    * commented child', 'comment detail', '-->', '* parent', '  * child'].join('\n')
    )
  })

  test('moves multiline comments after a continued list item', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '  * [[https://example.com|parent',
        'continued label]]',
        '<!--    * commented child',
        'comment detail',
        '-->',
        '    * child'
      ].join('\n')
    )

    expect(markdown).toContain(
      [
        '<!--    * commented child',
        'comment detail',
        '-->',
        '* [parent continued label](https://example.com)',
        '  * child'
      ].join('\n')
    )
  })

  test('converts multiline DokuWiki links inside list items', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * [[https://ssdh233.me/popn-sudden/|新筐体用', 'SUDDEN+数値計算ツール]] SUD計算機（スマホ向け）'].join('\n')
    )

    expect(markdown).toBe('* [新筐体用 SUDDEN+数値計算ツール](https://ssdh233.me/popn-sudden/) SUD計算機（スマホ向け）')
  })

  test('moves DokuWiki line comments out of list blocks', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['  * parent', '// comment', '    * child'].join('\n'))

    expect(markdown).toContain(['<!-- comment-->', '* parent', '  * child'].join('\n'))
  })

  test('moves comments before forced line breaks split list items', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * parent line 1\\\\ parent line 2', '<!-- comment -->', '    * child'].join('\n')
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

  test('splits bold text that contains a link and following text', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      '* **[譜面画像製作](/その他/譜面画像製作案内ページ)の人手が不足しています。**協力してくれる方は[譜面画像製作](/その他/譜面画像製作案内ページ)に製作方法が載っているので宜しくお願いします'
    )

    expect(markdown).toBe(
      '* [**譜面画像製作**](/その他/譜面画像製作案内ページ)**の人手が不足しています。** 協力してくれる方は[譜面画像製作](/その他/譜面画像製作案内ページ)に製作方法が載っているので宜しくお願いします'
    )
  })

  test('trims spaces inside bold markers', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * ** ハイパーJパーティーロック(EX) **', '  * ** 太字** と **太字 **'].join('\n')
    )

    expect(markdown).toBe(['* **ハイパーJパーティーロック(EX)**', '* **太字** と **太字**'].join('\n'))
  })

  test('does not trim bold-looking markers inside code or comments', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['  * %%** text **%%', '/* ** text ** */'].join('\n'))

    expect(markdown).toBe(['<!-- ** text ** -->', '* `** text **`'].join('\n'))
  })

  test('adds a space after bold ending with punctuation before Japanese text', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * **事前準備:**キャラ', '  * **完全無条件解禁。**未解禁', '  * **「乱ノック」**です'].join('\n')
    )

    expect(markdown).toBe(
      ['* **事前準備:** キャラ', '* **完全無条件解禁。** 未解禁', '* **「乱ノック」** です'].join('\n')
    )
  })

  test('does not add a space after ordinary bold text', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown('  * **Lv**50')

    expect(markdown).toBe('* **Lv**50')
  })

  test('adds a space before bold markers attached to preceding text', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * 新筐体**「ピカピカポップ君モデル」**。', 'perfect**(削除対策につき音なし)**'].join('\n')
    )

    expect(markdown).toBe(
      ['* 新筐体 **「ピカピカポップ君モデル」**。', 'perfect **(削除対策につき音なし)**'].join('\n')
    )
  })
})

describe('DokuWiki legacy URL seed conversion', () => {
  test('normalizes malformed external URL separators in DokuWiki links', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '* [[https///baanin.sakura.ne.jp/p13fumen/hardpf/hardpf-h.htm|ハードPf(H)]]',
        '* [[緑の風を唱えた！>http:::www.nicovideo.jp:watch:sm5397758]]'
      ].join('\n')
    )

    expect(markdown).toBe(
      [
        '* [ハードPf(H)](https://baanin.sakura.ne.jp/p13fumen/hardpf/hardpf-h.htm)',
        '* [緑の風を唱えた！](http://www.nicovideo.jp/watch/sm5397758)'
      ].join('\n')
    )
  })

  test('keeps external media URLs external when converting to links', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '  * {{https://baanin.sakura.ne.jp/p13fumen/hardpf/hardpf-h.htm|ハードPf(H)}}',
        '{{https://www.php.net/images/php.gif?200x50}}'
      ].join('\n')
    )

    expect(markdown).toBe(
      [
        '* [ハードPf(H)](https://baanin.sakura.ne.jp/p13fumen/hardpf/hardpf-h.htm)',
        '[](https://www.php.net/images/php.gif?200x50)'
      ].join('\n')
    )
  })

  test('normalizes malformed external URL separators in existing Markdown links', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '* [ハードPf(H)](/https///baanin.sakura.ne.jp/p13fumen/hardpf/hardpf-h.htm)',
        '([https///pop-toriaezu.com/](https://pop-toriaezu.com/))',
        '[Hyperでもeasy](/_https///www.youtube.com/watch_v_yqdghdjebj8)'
      ].join('\n')
    )

    expect(markdown).toBe(
      [
        '* [ハードPf(H)](https://baanin.sakura.ne.jp/p13fumen/hardpf/hardpf-h.htm)',
        '([https://pop-toriaezu.com/](https://pop-toriaezu.com/))',
        '[Hyperでもeasy](https://www.youtube.com/watch_v_yqdghdjebj8)'
      ].join('\n')
    )
  })

  test('removes leading underscores from internal link URL segments', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '[[難易度表:_you_ex|you(EX)]]',
        '[たまご](/_難易度表/たまごの物理科学的_ex)',
        '[you](/難易度表/_you_ex)',
        '[external](/_https///example.com/path)'
      ].join('\n')
    )

    expect(markdown).toBe(
      [
        '[you(EX)](/難易度表/you_ex)',
        '[たまご](/難易度表/たまごの物理科学的_ex)',
        '[you](/難易度表/you_ex)',
        '[external](https://example.com/path)'
      ].join('\n')
    )
  })

  test('keeps EUC-JP percent-encoded external links working without MDC URI errors', async () => {
    const { convertDokuwikiToMarkdown, createBodyAstForSeed } = await loadSeedTask()
    const url = 'http://www.wikihouse.com/popnwakaba/index.php?%A5%E9%A5%D4%A5%B9%A5%C8%A5%EA%A5%A2%BF%B7%B6%CA'
    const markdown = convertDokuwikiToMarkdown(`[[${url}|ラピストリア新曲]]`)

    expect(markdown).toBe(`[ラピストリア新曲](${url})`)
    expect(await createBodyAstForSeed(markdown, 'test')).toBeTruthy()
  })

  test('replaces retired popn.hyrorre.com links with popn.wiki', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      [
        '[[https://popn.hyrorre.com/%E3%81%9D%E3%81%AE%E4%BB%96/s%E4%B9%B1lv0%E9%9B%A3%E6%98%93%E5%BA%A6%E8%A1%A8]]',
        '[旧URL](http://popn.hyrorre.com/foo)',
        'popn.hyrorre.com → popn.wiki'
      ].join('\n')
    )

    expect(markdown).toBe(
      [
        '[https://popn.wiki/%E3%81%9D%E3%81%AE%E4%BB%96/s%E4%B9%B1lv0%E9%9B%A3%E6%98%93%E5%BA%A6%E8%A1%A8](https://popn.wiki/%E3%81%9D%E3%81%AE%E4%BB%96/s%E4%B9%B1lv0%E9%9B%A3%E6%98%93%E5%BA%A6%E8%A1%A8)',
        '[旧URL](https://popn.wiki/foo)',
        'popn.wiki → popn.wiki'
      ].join('\n')
    )
  })

  test('leaves malformed legacy paths unchanged when URI decoding fails', async () => {
    const { decodeLegacyPath } = await loadSeedTask()
    const path = '%A5%E9%A5%D4'

    expect(decodeLegacyPath(path)).toBe(path)
  })
})

describe('DokuWiki footnote seed conversion', () => {
  test('moves footnote definitions after list blocks', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(
      ['  * parent', '    * child ((child note))', '    * child2 ((child2 note))', '  * next'].join('\n')
    )

    expect(markdown).toBe(
      ['* parent', '  * child [^1]', '  * child2 [^2]', '* next', '[^1]: child note', '[^2]: child2 note'].join('\n')
    )
  })

  test('moves footnote definitions after table blocks', async () => {
    const { convertDokuwikiToMarkdown } = await loadSeedTask()
    const markdown = convertDokuwikiToMarkdown(['^A^B^', '|1((one note))|2|', '|3|4((four note))|', 'after'].join('\n'))

    expect(markdown).toBe(
      [
        '| A | B |',
        '| --- | --- |',
        '| 1[^1] | 2 |',
        '| 3 | 4[^2] |',
        '[^1]: one note',
        '[^2]: four note',
        'after'
      ].join('\n')
    )
  })
})
