import fs from 'fs'
import path from 'path'
import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'
import { unserialize } from 'php-serialize'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'

export const D1_STATEMENT_CHUNK_SIZE = 80000
export const BODY_AST_SOURCE_MAX_LENGTH = 80000
export const BODY_AST_JSON_MAX_LENGTH = 80000

const specialCharacters = [
  '\u{1a}',
  '\u{1b}',
  '\u{1c}',
  '\u{1d}',
  '\u{1e}',
  '\u{1f}',
  '\u{20}',
  '\u{21}',
  '\u{22}',
  '\u{23}',
  '\u{24}',
  '\u{25}',
  '\u{26}',
  '\u{27}',
  '\u{28}',
  '\u{29}',
  '\u{2b}',
  '\u{2c}',
  '\u{2f}',
  '\u{3b}',
  '\u{3c}',
  '\u{3d}',
  '\u{3e}',
  '\u{3f}',
  '\u{40}',
  '\u{5b}',
  '\u{5c}',
  '\u{5d}',
  '\u{5e}',
  '\u{60}',
  '\u{7b}',
  '\u{7c}',
  '\u{7d}',
  '\u{7e}',
  '\u{7f}',
  '\u{80}',
  '\u{81}',
  '\u{82}',
  '\u{83}',
  '\u{84}',
  '\u{85}',
  '\u{86}',
  '\u{87}',
  '\u{88}',
  '\u{89}',
  '\u{8a}',
  '\u{8b}',
  '\u{8c}',
  '\u{8d}',
  '\u{8e}',
  '\u{8f}',
  '\u{90}',
  '\u{91}',
  '\u{92}',
  '\u{93}',
  '\u{94}',
  '\u{95}',
  '\u{96}',
  '\u{97}',
  '\u{98}',
  '\u{99}',
  '\u{9a}',
  '\u{9b}',
  '\u{9c}',
  '\u{9d}',
  '\u{9e}',
  '\u{9f}',
  '\u{a0}',
  '\u{a1}',
  '\u{a2}',
  '\u{a3}',
  '\u{a4}',
  '\u{a5}',
  '\u{a6}',
  '\u{a7}',
  '\u{a8}',
  '\u{a9}',
  '\u{aa}',
  '\u{ab}',
  '\u{ac}',
  '\u{ad}',
  '\u{ae}',
  '\u{af}',
  '\u{b0}',
  '\u{b1}',
  '\u{b2}',
  '\u{b3}',
  '\u{b4}',
  '\u{b5}',
  '\u{b6}',
  '\u{b7}',
  '\u{b8}',
  '\u{b9}',
  '\u{ba}',
  '\u{bb}',
  '\u{bc}',
  '\u{bd}',
  '\u{be}',
  '\u{bf}',
  '\u{d7}',
  '\u{f7}',
  '\u{2c7}',
  '\u{2d8}',
  '\u{2d9}',
  '\u{2da}',
  '\u{2db}',
  '\u{2dc}',
  '\u{2dd}',
  '\u{300}',
  '\u{301}',
  '\u{303}',
  '\u{309}',
  '\u{323}',
  '\u{384}',
  '\u{385}',
  '\u{387}',
  '\u{5b0}',
  '\u{5b1}',
  '\u{5b2}',
  '\u{5b3}',
  '\u{5b4}',
  '\u{5b5}',
  '\u{5b6}',
  '\u{5b7}',
  '\u{5b8}',
  '\u{5b9}',
  '\u{5bb}',
  '\u{5bc}',
  '\u{5bd}',
  '\u{5be}',
  '\u{5bf}',
  '\u{5c0}',
  '\u{5c1}',
  '\u{5c2}',
  '\u{5c3}',
  '\u{5f3}',
  '\u{5f4}',
  '\u{60c}',
  '\u{61b}',
  '\u{61f}',
  '\u{640}',
  '\u{64b}',
  '\u{64c}',
  '\u{64d}',
  '\u{64e}',
  '\u{64f}',
  '\u{650}',
  '\u{651}',
  '\u{652}',
  '\u{66a}',
  '\u{e3f}',
  '\u{200c}',
  '\u{200d}',
  '\u{200e}',
  '\u{200f}',
  '\u{2013}',
  '\u{2014}',
  '\u{2015}',
  '\u{2017}',
  '\u{2018}',
  '\u{2019}',
  '\u{201a}',
  '\u{201c}',
  '\u{201d}',
  '\u{201e}',
  '\u{2020}',
  '\u{2021}',
  '\u{2022}',
  '\u{2026}',
  '\u{2030}',
  '\u{2032}',
  '\u{2033}',
  '\u{2039}',
  '\u{203a}',
  '\u{2044}',
  '\u{20a7}',
  '\u{20aa}',
  '\u{20ab}',
  '\u{20ac}',
  '\u{2116}',
  '\u{2118}',
  '\u{2122}',
  '\u{2126}',
  '\u{2135}',
  '\u{2190}',
  '\u{2191}',
  '\u{2192}',
  '\u{2193}',
  '\u{2194}',
  '\u{2195}',
  '\u{21b5}',
  '\u{21d0}',
  '\u{21d1}',
  '\u{21d2}',
  '\u{21d3}',
  '\u{21d4}',
  '\u{2200}',
  '\u{2202}',
  '\u{2203}',
  '\u{2205}',
  '\u{2206}',
  '\u{2207}',
  '\u{2208}',
  '\u{2209}',
  '\u{220b}',
  '\u{220f}',
  '\u{2211}',
  '\u{2212}',
  '\u{2215}',
  '\u{2217}',
  '\u{2219}',
  '\u{221a}',
  '\u{221d}',
  '\u{221e}',
  '\u{2220}',
  '\u{2227}',
  '\u{2228}',
  '\u{2229}',
  '\u{222a}',
  '\u{222b}',
  '\u{2234}',
  '\u{223c}',
  '\u{2245}',
  '\u{2248}',
  '\u{2260}',
  '\u{2261}',
  '\u{2264}',
  '\u{2265}',
  '\u{2282}',
  '\u{2283}',
  '\u{2284}',
  '\u{2286}',
  '\u{2287}',
  '\u{2295}',
  '\u{2297}',
  '\u{22a5}',
  '\u{22c5}',
  '\u{2310}',
  '\u{2320}',
  '\u{2321}',
  '\u{2329}',
  '\u{232a}',
  '\u{2469}',
  '\u{2500}',
  '\u{2502}',
  '\u{250c}',
  '\u{2510}',
  '\u{2514}',
  '\u{2518}',
  '\u{251c}',
  '\u{2524}',
  '\u{252c}',
  '\u{2534}',
  '\u{253c}',
  '\u{2550}',
  '\u{2551}',
  '\u{2552}',
  '\u{2553}',
  '\u{2554}',
  '\u{2555}',
  '\u{2556}',
  '\u{2557}',
  '\u{2558}',
  '\u{2559}',
  '\u{255a}',
  '\u{255b}',
  '\u{255c}',
  '\u{255d}',
  '\u{255e}',
  '\u{255f}',
  '\u{2560}',
  '\u{2561}',
  '\u{2562}',
  '\u{2563}',
  '\u{2564}',
  '\u{2565}',
  '\u{2566}',
  '\u{2567}',
  '\u{2568}',
  '\u{2569}',
  '\u{256a}',
  '\u{256b}',
  '\u{256c}',
  '\u{2580}',
  '\u{2584}',
  '\u{2588}',
  '\u{258c}',
  '\u{2590}',
  '\u{2591}',
  '\u{2592}',
  '\u{2593}',
  '\u{25a0}',
  '\u{25b2}',
  '\u{25bc}',
  '\u{25c6}',
  '\u{25ca}',
  '\u{25cf}',
  '\u{25d7}',
  '\u{2605}',
  '\u{260e}',
  '\u{261b}',
  '\u{261e}',
  '\u{2660}',
  '\u{2663}',
  '\u{2665}',
  '\u{2666}',
  '\u{2701}',
  '\u{2702}',
  '\u{2703}',
  '\u{2704}',
  '\u{2706}',
  '\u{2707}',
  '\u{2708}',
  '\u{2709}',
  '\u{270c}',
  '\u{270d}',
  '\u{270e}',
  '\u{270f}',
  '\u{2710}',
  '\u{2711}',
  '\u{2712}',
  '\u{2713}',
  '\u{2714}',
  '\u{2715}',
  '\u{2716}',
  '\u{2717}',
  '\u{2718}',
  '\u{2719}',
  '\u{271a}',
  '\u{271b}',
  '\u{271c}',
  '\u{271d}',
  '\u{271e}',
  '\u{271f}',
  '\u{2720}',
  '\u{2721}',
  '\u{2722}',
  '\u{2723}',
  '\u{2724}',
  '\u{2725}',
  '\u{2726}',
  '\u{2727}',
  '\u{2729}',
  '\u{272a}',
  '\u{272b}',
  '\u{272c}',
  '\u{272d}',
  '\u{272e}',
  '\u{272f}',
  '\u{2730}',
  '\u{2731}',
  '\u{2732}',
  '\u{2733}',
  '\u{2734}',
  '\u{2735}',
  '\u{2736}',
  '\u{2737}',
  '\u{2738}',
  '\u{2739}',
  '\u{273a}',
  '\u{273b}',
  '\u{273c}',
  '\u{273d}',
  '\u{273e}',
  '\u{273f}',
  '\u{2740}',
  '\u{2741}',
  '\u{2742}',
  '\u{2743}',
  '\u{2744}',
  '\u{2745}',
  '\u{2746}',
  '\u{2747}',
  '\u{2748}',
  '\u{2749}',
  '\u{274a}',
  '\u{274b}',
  '\u{274d}',
  '\u{274f}',
  '\u{2750}',
  '\u{2751}',
  '\u{2752}',
  '\u{2756}',
  '\u{2758}',
  '\u{2759}',
  '\u{275a}',
  '\u{275b}',
  '\u{275c}',
  '\u{275d}',
  '\u{275e}',
  '\u{2761}',
  '\u{2762}',
  '\u{2763}',
  '\u{2764}',
  '\u{2765}',
  '\u{2766}',
  '\u{2767}',
  '\u{277f}',
  '\u{2789}',
  '\u{2793}',
  '\u{2794}',
  '\u{2798}',
  '\u{2799}',
  '\u{279a}',
  '\u{279b}',
  '\u{279c}',
  '\u{279d}',
  '\u{279e}',
  '\u{279f}',
  '\u{27a0}',
  '\u{27a1}',
  '\u{27a2}',
  '\u{27a3}',
  '\u{27a4}',
  '\u{27a5}',
  '\u{27a6}',
  '\u{27a7}',
  '\u{27a8}',
  '\u{27a9}',
  '\u{27aa}',
  '\u{27ab}',
  '\u{27ac}',
  '\u{27ad}',
  '\u{27ae}',
  '\u{27af}',
  '\u{27b1}',
  '\u{27b2}',
  '\u{27b3}',
  '\u{27b4}',
  '\u{27b5}',
  '\u{27b6}',
  '\u{27b7}',
  '\u{27b8}',
  '\u{27b9}',
  '\u{27ba}',
  '\u{27bb}',
  '\u{27bc}',
  '\u{27bd}',
  '\u{27be}',
  '\u{3000}',
  '\u{3001}',
  '\u{3002}',
  '\u{3003}',
  '\u{3008}',
  '\u{3009}',
  '\u{300a}',
  '\u{300b}',
  '\u{300c}',
  '\u{300d}',
  '\u{300e}',
  '\u{300f}',
  '\u{3010}',
  '\u{3011}',
  '\u{3012}',
  '\u{3014}',
  '\u{3015}',
  '\u{3016}',
  '\u{3017}',
  '\u{3018}',
  '\u{3019}',
  '\u{301a}',
  '\u{301b}',
  '\u{3036}',
  '\u{f6d9}',
  '\u{f6da}',
  '\u{f6db}',
  '\u{f8d7}',
  '\u{f8d8}',
  '\u{f8d9}',
  '\u{f8da}',
  '\u{f8db}',
  '\u{f8dc}',
  '\u{f8dd}',
  '\u{f8de}',
  '\u{f8df}',
  '\u{f8e0}',
  '\u{f8e1}',
  '\u{f8e2}',
  '\u{f8e3}',
  '\u{f8e4}',
  '\u{f8e5}',
  '\u{f8e6}',
  '\u{f8e7}',
  '\u{f8e8}',
  '\u{f8e9}',
  '\u{f8ea}',
  '\u{f8eb}',
  '\u{f8ec}',
  '\u{f8ed}',
  '\u{f8ee}',
  '\u{f8ef}',
  '\u{f8f0}',
  '\u{f8f1}',
  '\u{f8f2}',
  '\u{f8f3}',
  '\u{f8f4}',
  '\u{f8f5}',
  '\u{f8f6}',
  '\u{f8f7}',
  '\u{f8f8}',
  '\u{f8f9}',
  '\u{f8fa}',
  '\u{f8fb}',
  '\u{f8fc}',
  '\u{f8fd}',
  '\u{f8fe}',
  '\u{fe7c}',
  '\u{fe7d}',
  '\u{ff01}',
  '\u{ff02}',
  '\u{ff03}',
  '\u{ff04}',
  '\u{ff05}',
  '\u{ff06}',
  '\u{ff07}',
  '\u{ff08}',
  '\u{ff09}',
  '\u{ff09}',
  '\u{ff0a}',
  '\u{ff0b}',
  '\u{ff0c}',
  '\u{ff0d}',
  '\u{ff0e}',
  '\u{ff0f}',
  '\u{ff1a}',
  '\u{ff1b}',
  '\u{ff1c}',
  '\u{ff1d}',
  '\u{ff1e}',
  '\u{ff1f}',
  '\u{ff20}',
  '\u{ff3b}',
  '\u{ff3c}',
  '\u{ff3d}',
  '\u{ff3e}',
  '\u{ff40}',
  '\u{ff5b}',
  '\u{ff5c}',
  '\u{ff5d}',
  '\u{ff5e}',
  '\u{ff5f}',
  '\u{ff60}',
  '\u{ff61}',
  '\u{ff62}',
  '\u{ff63}',
  '\u{ff64}',
  '\u{ff65}',
  '\u{ffe0}',
  '\u{ffe1}',
  '\u{ffe2}',
  '\u{ffe3}',
  '\u{ffe4}',
  '\u{ffe5}',
  '\u{ffe6}',
  '\u{ffe8}',
  '\u{ffe9}',
  '\u{ffea}',
  '\u{ffeb}',
  '\u{ffec}',
  '\u{ffed}',
  '\u{ffee}',
  '\u{1d6fc}',
  '\u{1d6fd}',
  '\u{1d6fe}',
  '\u{1d6ff}',
  '\u{1d700}',
  '\u{1d701}',
  '\u{1d702}',
  '\u{1d703}',
  '\u{1d704}',
  '\u{1d705}',
  '\u{1d706}',
  '\u{1d707}',
  '\u{1d708}',
  '\u{1d709}',
  '\u{1d70a}',
  '\u{1d70b}',
  '\u{1d70c}',
  '\u{1d70d}',
  '\u{1d70e}',
  '\u{1d70f}',
  '\u{1d710}',
  '\u{1d711}',
  '\u{1d712}',
  '\u{1d713}',
  '\u{1d714}',
  '\u{1d715}',
  '\u{1d716}',
  '\u{1d717}',
  '\u{1d718}',
  '\u{1d719}',
  '\u{1d71a}',
  '\u{1d71b}',
  '\u{c2a0}'
]

export function getFilesRecursively(dir: string): string[] {
  let results: string[] = []
  const list = fs.readdirSync(dir)

  list.forEach((file) => {
    file = path.resolve(dir, file)
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      // ディレクトリなら再帰的に取得
      results = results.concat(getFilesRecursively(file))
    } else {
      // ファイルなら追加
      results.push(file)
    }
  })
  return results
}

/**
 * テキストから最初の見出しを抽出する（DokuWiki形式とMarkdown形式の両方に対応）
 * [タイトル]{.hoge} のようなMDC形式の属性も除去する
 */
function extractTitle(content: string): string | null {
  // 1. DokuWiki形式 (====== Title =====)
  const dokuMatch = content.match(/^(={2,6})\s*(.*?)\s*\1\s*$/m)
  if (dokuMatch?.[2]) {
    let title = dokuMatch[2].trim()
    const cleanMatch = title?.match(/^\[(.*?)\]\{.*?\}$/) || ''
    if (cleanMatch) title = cleanMatch[1]?.trim() || ''
    return title || null
  }

  // 2. Markdown形式 (# Title)
  const mdMatch = content.match(/^#{1,6}\s+(.*)$/m)
  if (mdMatch?.[1]) {
    let title = mdMatch[1].trim()
    const cleanMatch = title.match(/^\[(.*?)\]\{.*?\}$/)
    if (cleanMatch) title = cleanMatch[1]?.trim() || ''
    return title || null
  }

  return null
}

/**
 * 全ページをスキャンしてパスとタイトルの対応マップを作成する
 */
export function buildTitleMap(pagesDir: string): Map<string, string> {
  const titleMap = new Map<string, string>()
  const files = getFilesRecursively(pagesDir).filter((f) => f.endsWith('.txt'))

  for (const file of files) {
    const relativePath = path
      .relative(pagesDir, file)
      .replace(/\.txt$/, '')
      .replace(/\\/g, '/')
    const pagePath = relativePath === 'start' ? '/' : decodeLegacyPath(relativePath)
    const dbPath = pagePath.toLowerCase()

    try {
      const content = fs.readFileSync(file, 'utf8')
      const title = extractTitle(content)
      if (title) {
        titleMap.set(dbPath, title)
      }
    } catch (e) {
      console.warn(`Failed to read for title map: ${file}`, e)
    }
  }

  return titleMap
}

/**
 * URL のパーセントエンコーディングが不正（非UTF-8など）な場合に修正を試みる
 */
function fixMalformedUrl(url: string): string {
  if (!url.includes('%')) return url
  try {
    decodeURIComponent(url)
    return url
  } catch {
    // 不正なシーケンスが含まれる場合、EUC-JP としてデコードを試みる
    return url.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
      try {
        return decodeURIComponent(match)
      } catch {
        const bytes = new Uint8Array(
          match
            .split('%')
            .filter(Boolean)
            .map((h) => parseInt(h, 16))
        )
        try {
          return new TextDecoder('euc-jp').decode(bytes)
        } catch {
          return match
        }
      }
    })
  }
}

export function decodeLegacyPath(pathValue: string): string {
  if (!pathValue.includes('%')) return pathValue

  try {
    return decodeURI(pathValue)
  } catch {
    const decoded = fixMalformedUrl(pathValue)
    if (decoded !== pathValue) {
      console.warn(`[Warn] Decoded malformed legacy path: ${pathValue} -> ${decoded}`)
    } else {
      console.warn(`[Warn] Could not decode malformed legacy path: ${pathValue}`)
    }
    return decoded
  }
}

function containsUnsafePercentEncoding(markdown: string): boolean {
  const percentRuns = markdown.matchAll(/%(?:[0-9A-Fa-f]{2})*/g)

  for (const match of percentRuns) {
    const value = match[0]
    if (!value || value.length % 3 !== 0) return true

    try {
      decodeURIComponent(value)
    } catch {
      return true
    }
  }

  return false
}

export function convertDokuwikiToMarkdown(input: string, titleMap?: Map<string, string>): string {
  let text = input

  // 単一の [ または ] をエスケープ (DokuWiki のリンク [[...]] を除く)
  text = text.replace(/(?<!\[)\[(?!\[)/g, '\\[')
  text = text.replace(/(?<!\])\](?!\])/g, '\\]')

  // 特殊コメントマーカー: %%//%% 以降をコメント扱い -> <!-- ... -->
  // 例: "text %%//%% comment" -> "text <!-- comment -->"
  text = text.replace(/^(.*)%%\/\/%%(.*)$/gm, (_m, before, comment) => {
    return `${before}<!--${comment}-->`
  })

  // 整形の無効化: %%...%% に対応（中身はそのまま表示し、他の変換の対象外にする）
  // 最後に Markdown のインラインコードとして復元する
  const nowikiPlaceholders: string[] = []
  text = text.replace(/%%([\s\S]*?)%%/g, (_m, inner) => {
    const idx = nowikiPlaceholders.length
    nowikiPlaceholders.push(inner)
    return `__DOKU_NOWIKI_${idx}__`
  })

  // C言語スタイルコメント: /* ... */ -> <!-- ... -->
  text = text.replace(/\/\*([\s\S]*?)\*\//g, '<!--$1-->')

  // テーブル: Dokuwiki の ^ や | で始まる行を Markdown テーブルへ変換
  // 強制改行 (\\) より先に処理し、セル内の \\ は <br> に変換する
  // DokuWiki テーブル内のコメント行は Markdown テーブルを分断するため、テーブル直前へ移動する
  text = text.replace(/(^[ \t]*[\^|].*(?:\n[ \t]*(?:[\^|].*|<!--.*-->[ \t]*))*)/gm, (block) => {
    const blockLines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const liftedComments = blockLines.filter((l) => /^<!--.*-->$/.test(l))
    const lines = blockLines.filter((l) => l.startsWith('^') || l.startsWith('|'))

    if (lines.length === 0) return block

    // 1行をセル配列に変換
    // 空白なしの空セル (||) は横結合マーカー ">"、DokuWiki の縦結合 (:::) は "~" にする
    const parseRow = (line: string) => {
      const marker = line[0] as string // '^' または '|'
      const inner = line.slice(1, line.endsWith(marker) ? -1 : undefined)
      return inner.split(marker).map((cell) => {
        if (cell === '') return '>'
        if (cell.trim() === ':::') return '~'
        // セル内の \\ を <br> に変換（テーブル行を壊さないように）
        return cell.replace(/\\\\([ \t]*)/g, '<br>').trim()
      })
    }

    const rows = lines.map(parseRow)
    if (rows.length === 0) return block

    const header = rows[0]
    if (!header) return block
    const colCount = header.length
    const separator = Array(colCount).fill('---')

    const toMarkdownRow = (cells: string[]) => `| ${cells.join(' | ')} |`

    const mdLines: string[] = []
    mdLines.push(toMarkdownRow(header))
    mdLines.push(toMarkdownRow(separator))

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row) {
        mdLines.push(toMarkdownRow(row))
      }
    }

    const markdownTable = mdLines.join('\n')
    if (liftedComments.length === 0) return markdownTable
    return `${liftedComments.join('\n')}\n${markdownTable}`
  })

  // 強制改行: \\ -> 改行（表示時は remark-breaks 前提で改行として扱う）
  text = text.replace(/\\\\([ \t]*)/g, '\n')

  // 見出し: ====== Title ====== など -> # Title
  text = text.replace(/^(={2,6})\s*(.*?)\s*\1\s*$/gm, (_m, eq, title) => {
    const dokuwikiLevel = Math.min(eq.length, 6)
    const mdLevel = Math.min(Math.max(7 - dokuwikiLevel, 1), 6) // 6->1,5->2,...,2->5
    return '#'.repeat(mdLevel) + ' ' + title
  })

  // アンカー: &aname(id);
  // まず「見出し直前」のケースを優先し、見出し行に埋め込んでpage titleを確実に取得する
  // 例:
  // &aname(sec1);
  // # Title
  // -> # [Title]{#sec1}
  text = text.replace(
    /&aname\(([A-Za-z0-9_-]+)\);\s*\r?\n(#{1,6}\s+)(.*)$/gm,
    (_m, id, hashes, title) => `${hashes}[${title}]{#${id}}`
  )

  // 残ったアンカーはインライン要素として変換
  // id には英数字と - _ のみ許可
  text = text.replace(/&aname\(([A-Za-z0-9_-]+)\);/g, '[]{#$1}')

  // カラータグ: <color #ffff77>, <color /#ffff77>, <color #ffffff/#000000>
  text = text.replace(
    /<color\s+([#A-Za-z0-9_-]*)\s*(?:\/\s*([#A-Za-z0-9_-]+))?\s*>([\s\S]*?)<\/color>/gi,
    (_m, fg, bg, content) => {
      const styles = []
      if (fg) styles.push(`color: ${fg}`)
      if (bg) styles.push(`background-color: ${bg}`)
      return `<span style="${styles.join('; ')}">${content}</span>`
    }
  )

  // Fontsize2プラグイン: <fs size>テキスト</fs> -> <span style="font-size: size">テキスト</span>
  text = text.replace(
    /<fs\s+([^>]+?)\s*>([\s\S]*?)<\/fs>/gi,
    (_m, size, content) => `[${content}]{style="font-size: ${size}"}`
  )

  // NEWタグ: &new{text}; -> [text]{.andnew}
  text = text.replace(/&new\{([^}]+)\};/g, '[$1]{.andnew}')

  // CommentIDタグ: &commentid{id}; -> [id]{.andcommentid}
  text = text.replace(/&commentid\{([^}]+)\};/g, '[$1]{.andcommentid}')

  // リストマーカー: 行頭が * または - で、直後にスペースがない場合にスペースを追加
  // 例: "*item" -> "* item", "-item" -> "- item"
  text = text.replace(/^([ \t]*)([*-])(?!\s)(.+)$/gm, (_m, indent, marker, rest) => {
    return `${indent}${marker} ${rest}`
  })

  // 1行コメント: // ... -> <!-- ... -->
  // 行頭（空白のみ許可）にある // を対象とし、URL (http:// など) は変換しない
  text = text.replace(/^(\s*)\/\/(.*)$/gm, (_m, indent, content) => {
    // http://, https:// で始まる行はスキップ
    const trimmed = content.trimStart()
    if (/^https?:\/\//.test(trimmed)) return _m
    return `${indent}<!--${content}-->`
  })

  // コードブロック: <code>...</code> -> ```...```
  text = text.replace(/<code(?: [^>]*)?>([\s\S]*?)<\/code>/gi, (_m, code) => {
    // 先頭と末尾の改行を整える
    const trimmed = code.replace(/^\n+/, '').replace(/\n+$/, '')
    return '```\n' + trimmed + '\n```'
  })

  // イタリック: //text// -> *text*
  // URL (http://, https://) に影響しないように http(s): の直後は除外
  text = text.replace(/(^|[^\w:])\/\/(.+?)\/\//g, (_m, prefix, content) => {
    return prefix + '*' + content + '*'
  })

  // インラインコード: ''code'' -> `code`
  text = text.replace(/''(.*?)''/g, '`$1`')

  // フォントサイズショートカット
  // 160%
  text = text.replace(/#{4}(.+?)#{4}/g, '[$1]{.text-2xl}')
  // 140%
  text = text.replace(/#{3}(.+?)#{3}/g, '[$1]{.text-xl}')
  // 120%
  text = text.replace(/#{2}(.+?)#{2}/g, '[$1]{.text-lg}')
  // 60%
  text = text.replace(/,{3}(.+?),{3}/g, '[$1]{.text-xs}')
  // 80%
  text = text.replace(/,{2}(.+?),{2}/g, '[$1]{.text-sm}')

  // 内部/外部リンク: [[target|label]] / [[target]] -> [label](url)
  text = text.replace(/\[\[(.+?)\]\]/g, (_m, inner: string) => {
    let target = inner
    let label = ''
    let isExplicitLabel = false
    let linkAttrs = ''

    const colorLinkMatch = inner.match(/^(.*?)<:color>>(.*?)\|<color\s+([^>]+)$/i)
    if (colorLinkMatch) {
      label = colorLinkMatch[1]?.trim() || ''
      target = colorLinkMatch[2]?.trim() || ''
      const color = colorLinkMatch[3]?.trim()
      if (color) {
        linkAttrs = `{style="color: ${color.replace(/"/g, '&quot;')}"}`
      }
      isExplicitLabel = true
    } else if (inner.includes('|')) {
      const pipeIndex = inner.indexOf('|')
      target = inner.slice(0, pipeIndex)
      label = inner.slice(pipeIndex + 1).trim()
      isExplicitLabel = true
    } else {
      target = inner
      label = inner.trim()
    }

    let url = target.trim()
    let isInternal = false

    // 内部リンク
    if (!url.startsWith('http')) {
      isInternal = true
      // dokuwiki の名前空間区切り : をパスの / に変換
      url = url.replace(/:/g, '/')

      // 先頭がスキームでなければルート相対パスにしておく
      if (!url.startsWith('#') && !/^[a-z]+:\/\/|^\//i.test(url)) {
        url = '/' + url
      }

      // specialCharacters (#以外)を_に変換
      url = url.replace(
        new RegExp(
          `[${specialCharacters
            .filter((c) => c !== '#' && c !== '/')
            .map((c) => c.replace(/[\\^\]-]/g, '\\$&'))
            .join('')}]`,
          'g'
        ),
        '_'
      )

      // 連続した_を1つにまとめる
      url = url.replace(/_+/g, '_')

      // 先頭と末尾 host の_を削除
      url = url.replace(/^_/, '').replace(/_$/, '')

      // urlを小文字に変換
      url = url.toLowerCase()
    } else {
      // 外部リンクの場合は不正なエンコーディングを修正
      url = fixMalformedUrl(url)
    }

    // ラベルの自動補完 (内部リンクかつ明示的なラベルがないか、ラベルが空の場合)
    if (isInternal && titleMap && (!isExplicitLabel || label === '')) {
      const dbPath = url.startsWith('/') && url.length > 1 ? url.substring(1) : url
      const title = titleMap.get(dbPath)

      if (title) {
        label = title
      }
    }

    if (!isExplicitLabel) {
      // labelの先頭が:だったらそれを削除
      label = label.replace(/^:/, '')
      // labelの:を/に置換
      label = label.replace(/:/g, '/')
    }

    return `[${label.trim()}](${url})${linkAttrs}`
  })

  // 画像: {{path|alt}} / {{path}} -> [alt](url)
  // 移行後は画像を直接埋め込まず、あえてリンクとして扱う
  text = text.replace(/\{\{([^|}]+?)(?:\|([^}]*))?\}\}/g, (_m, src, alt) => {
    let url = src.trim().replace(/:/g, '/')
    if (!/^[a-z]+:\/\/|^\//i.test(url)) {
      url = '/' + url
    } else {
      url = fixMalformedUrl(url)
    }

    // urlに?linkonlyが含まれている場合は削除
    url = url.replace(/\?linkonly/g, '')

    // specialCharacters (#以外)を_に変換
    url = url.replace(
      new RegExp(
        `[${specialCharacters
          .filter((c) => c !== '#' && c !== '/')
          .map((c) => c.replace(/[\\^\]-]/g, '\\$&'))
          .join('')}]`,
        'g'
      ),
      '_'
    )

    // 連続した_を1つにまとめる
    url = url.replace(/_+/g, '_')

    // 先頭と末尾 host の_を削除
    url = url.replace(/^_/, '').replace(/_$/, '')

    // urlを小文字に変換
    url = url.toLowerCase()

    const altText = (alt || '').trim()
    return `[${altText}](${url})`
  })

  // 整形無効領域を復元（''等幅'' との組み合わせも考慮してインラインコードにする）
  text = text.replace(/__DOKU_NOWIKI_(\d+)__/g, (_m, idxStr) => {
    const idx = Number(idxStr)
    let content = nowikiPlaceholders[idx] ?? ''
    // ''等幅'' のような Dokuwiki の等幅指定は中身だけ取り出す
    content = content.replace(/''(.*?)''/g, '$1')
    return '`' + content + '`'
  })

  // DISCUSSION タグを Frontmatter に変換
  let hasDiscussion = false
  let discussionTitle = ''
  let discussionClosed = false
  text = text.replace(/~~DISCUSSION(?::([^~|]+))?(?:\|([^~]+))?~~/g, (_m, flags: string, title: string) => {
    hasDiscussion = true
    if (flags?.includes('closed')) discussionClosed = true
    if (title) discussionTitle = title.trim()
    return ''
  })

  if (hasDiscussion) {
    let props = 'discussion: true\n'
    if (discussionClosed) {
      props += 'discussion-closed: true\n'
    }
    if (discussionTitle) {
      props += `discussion-title: "${discussionTitle.replace(/"/g, '\\"')}"\n`
    }

    if (text.startsWith('---\n')) {
      text = text.replace(/^---\n/, `---\n${props}`)
    } else {
      text = `---\n${props}---\n\n` + text.replace(/^\s+/, '')
    }
  }

  // NOTOCタグをFrontmatter に変換
  let hasNotoc = false
  text = text.replace(/~~NOTOC~~/g, (_m) => {
    hasNotoc = true
    return ''
  })

  if (hasNotoc) {
    const props = 'notoc: true\n'
    if (text.startsWith('---\n')) {
      text = text.replace(/^---\n/, `---\n${props}`)
    } else {
      text = `---\n${props}---\n\n` + text.replace(/^\s+/, '')
    }
  }

  // 脚注: ((テキスト)) -> [^1] (行末・次の行に定義を出力)
  let footnoteInd = 1
  const footnotesMap = new Map<number, string>()

  text = text.replace(/\(\(([\s\S]*?)\)\)/g, (_m, footnote) => {
    const id = footnoteInd++
    // 脚注内の改行はMarkdownのパース崩れを防ぐためスペースにする
    footnotesMap.set(id, footnote.trim().replace(/\n/g, ' '))
    return `[^${id}]__FN_${id}__`
  })

  // 行ごとに見ていき、マーカーがあればその行の直後に脚注を展開する
  text = text.replace(/^.*(?:__FN_\d+__).*$/gm, (line) => {
    const fnIds: number[] = []
    const replacedLine = line.replace(/__FN_(\d+)__/g, (__m, idStr) => {
      fnIds.push(Number(idStr))
      return ''
    })

    const defs = fnIds.map((id) => `\n[^${id}]: ${footnotesMap.get(id)}`).join('')
    return replacedLine + defs
  })

  // NOCACHEを削除
  text = text.replaceAll('~~NOCACHE~~', '')

  // sortable プラグインを MDC に変換
  // <sortable 1=category 4=bpm 7=numeric> -> ::sortable{c1=category c4=bpm c7=numeric}
  text = text.replace(/<sortable\s+([^>]*?)>/gi, (_m, attrs) => {
    const mdcAttrs = attrs.trim().replace(/(\d+)=([^\s>]+)/g, 'c$1="$2"')
    return `::sortable{${mdcAttrs}}`
  })
  text = text.replace(/<\/sortable>/gi, '::')

  // other convert
  text = text.replaceAll('[](/upload_/score/start/*)', ':ImageUploader')
  text = text.replaceAll('[](/medialist_/score/start/*)', ':ImageList')
  text = text.replaceAll(
    '[](/changes_count_7_type_create_edit_render_list_nosummary)',
    ':RecentEdits{limit="7" hideDetail="true"}'
  )
  text = text.replaceAll('[](/threads_*_count_7_simplelist_skipempty)', ':RecentComments{limit="7" hideDetail="true"}')
  text = text.replaceAll('合計: [total](/counter)', '')
  text = text.replaceAll('今日: [today](/counter)', '')
  text = text.replaceAll('昨日: [yesterday](/counter)', '')

  text = text.replaceAll('[](/threads_*_count_40_skipempty)', ':RecentComments')

  return text
}

// DokuWiki Discussion プラグインの .comments ファイルの型定義
export interface DokuWikiCommentUser {
  id: string
  name: string
  mail: string
  address: string
  url: string
}

export interface DokuWikiComment {
  user: DokuWikiCommentUser
  date: { created: number; replied?: number; modified?: number }
  raw: string
  xhtml: string
  parent: string | null
  replies: string[]
  show: boolean
  cid: string
}

export interface DokuWikiCommentsFile {
  title: string
  status: number
  number: number
  comments: Record<string, DokuWikiComment>
  subscribers: unknown
}

/**
 * .local/meta 配下の .comments ファイルを再帰的に取得して
 * パースし、全コメントを収集する
 */
export function collectAllComments(metaDir: string): {
  comments: { pagePath: string; comment: DokuWikiComment }[]
  users: Map<string, { id: string; name: string }>
} {
  const commentFiles = getFilesRecursively(metaDir).filter((f) => f.endsWith('.comments'))
  const allComments: { pagePath: string; comment: DokuWikiComment }[] = []
  const users = new Map<string, { id: string; name: string }>()

  for (const file of commentFiles) {
    const relativePath = path
      .relative(metaDir, file)
      .replace(/\.comments$/, '')
      .replace(/\\/g, '/')
    console.log(`[Debug] Processing comment file: ${relativePath}`)
    const pagePath = relativePath === 'start' ? '/' : decodeLegacyPath(relativePath)

    let parsed: DokuWikiCommentsFile
    try {
      const raw = fs.readFileSync(file, 'utf8')
      parsed = unserialize(raw) as DokuWikiCommentsFile
    } catch {
      console.warn(`Failed to parse: ${file}`)
      continue
    }

    if (!parsed.comments || typeof parsed.comments !== 'object') continue

    const comments = parsed.comments as Record<string, DokuWikiComment>
    for (const [, comment] of Object.entries(comments)) {
      // 非表示コメントはスキップ
      if (!comment.show) continue

      allComments.push({ pagePath, comment })

      // プロフィール情報を収集
      if (comment.user?.id && !users.has(comment.user.id)) {
        users.set(comment.user.id, {
          id: comment.user.id,
          name: comment.user.name || comment.user.id
        })
      }
    }
  }

  // コメントを作成日時順にソート（親が子より先に挿入されるように）
  allComments.sort((a, b) => a.comment.date.created - b.comment.date.created)

  console.log(`[Debug] collectAllComments finished. Total comments: ${allComments.length}, Total users: ${users.size}`)
  return { comments: allComments, users }
}

export function parseUsersAuth(
  filePath: string
): Map<string, { id: string; name: string; email: string; password: string }> {
  const usersMap = new Map<string, { id: string; name: string; email: string; password: string }>()
  if (!fs.existsSync(filePath)) return usersMap

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    // ':' は '\:' とエスケープされている可能性があるため、後読み否定を使って分割する
    const parts = trimmed.split(/(?<!\\):/).map((p) => p.replace(/\\:/g, ':'))
    if (parts.length >= 4) {
      const id = parts[0] || ''
      const password = parts[1] || ''
      const name = parts[2] || ''
      const email = parts[3] || ''
      usersMap.set(id, { id, name, email, password })
    }
  }
  return usersMap
}

/**
 * スキーマ定義を介さずに Raw SQL で挿入を行うヘルパー
 */
async function rawInsert(tableName: string, data: Record<string, string | number | boolean | null>) {
  const keys = Object.keys(data)
  const values = Object.values(data)
  const prefix = `INSERT INTO "${tableName}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (`
  const suffix = `) ON CONFLICT DO NOTHING`

  // Drizzle の sql オブジェクトを手動で組み立ててパラメータをバインドする
  let statement = sql.raw(prefix)
  for (let i = 0; i < values.length; i++) {
    if (i > 0) {
      statement = sql`${statement}, `
    }
    statement = sql`${statement}${values[i]}`
  }
  statement = sql`${statement}${sql.raw(suffix)}`

  await db.run(statement)
}

export async function createBodyAstForSeed(markdown: string, pagePath: string): Promise<string | null> {
  if (markdown.length > BODY_AST_SOURCE_MAX_LENGTH) return null
  if (containsUnsafePercentEncoding(markdown)) {
    console.log(`[Body AST] Skipped ${pagePath}: unsafe percent encoding`)
    return null
  }

  try {
    const ast = await parseMarkdown(markdown)
    const bodyAst = JSON.stringify(ast)
    if (bodyAst.length > BODY_AST_JSON_MAX_LENGTH) {
      console.log(
        `[Body AST] Skipped ${pagePath}: AST is too large (${bodyAst.length}/${BODY_AST_JSON_MAX_LENGTH} chars)`
      )
      return null
    }
    return bodyAst
  } catch (e) {
    console.warn(`[Body AST] Failed to parse ${pagePath}: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

export default defineTask({
  meta: {
    name: 'db:seed',
    description: 'Seed database with DokuWiki pages and comments converted to Markdown'
  },
  async run({ payload }) {
    const onlyPages = !!payload?.onlyPages
    const defaultUserId = 0
    let allComments: { pagePath: string; comment: DokuWikiComment }[] = []
    const oldUserIdToNewId = new Map<string, number>()

    if (!onlyPages) {
      // ===== ユーザー情報とコメントの収集 =====
      console.log('Seeding users...')
      const metaDir = path.resolve(process.cwd(), '.local/meta')
      let commentUsers = new Map<string, { id: string; name: string }>()

      if (fs.existsSync(metaDir)) {
        const parsed = collectAllComments(metaDir)
        allComments = parsed.comments
        commentUsers = parsed.users
      } else {
        console.warn('Meta directory not found:', metaDir)
      }

      const authUsers = parseUsersAuth(path.resolve(process.cwd(), '.local/users.auth.php'))

      const allUniqueUsers = new Map<string, { id: string; name: string; email: string; password: string }>()
      for (const [id, data] of authUsers) {
        allUniqueUsers.set(id, data)
      }
      for (const [id, data] of commentUsers) {
        if (!allUniqueUsers.has(id)) {
          allUniqueUsers.set(id, { ...data, email: `${id}@migrated.local`, password: '!' })
        }
      }

      // ユーザーの挿入
      await db.run(sql`DELETE FROM users`)
      const userNow = new Date().toISOString()

      for (const [oldId, user] of allUniqueUsers) {
        try {
          const res = (await db.get(sql`
            INSERT INTO users (name, email, password, created_at, updated_at, confirmed)
            VALUES (${user.name}, ${user.email}, ${user.password}, ${userNow}, ${userNow}, 1)
            ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
            RETURNING *
          `)) as { id?: number; ID?: number } | null
          if (res) console.log(`[Debug] User insert res for ${oldId}: ${JSON.stringify(res)}`)
          const newId = Array.isArray(res) ? res[0] : res?.id || res?.ID
          if (newId) {
            oldUserIdToNewId.set(oldId, newId)
          } else {
            console.warn(`[Warn] Could not get newId for user: ${oldId}. res: ${JSON.stringify(res)}`)
          }
        } catch (e: unknown) {
          console.error(`[Error] User insert failed ${oldId}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      console.log(`[Debug] oldUserIdToNewId size: ${oldUserIdToNewId.size}`)
      // defaultUserId = Array.from(oldUserIdToNewId.values())[0] || 0
    } else {
      // console.log('Skipping users insertion, fetching default userId...')
      // const firstUser = (await db.get(sql`SELECT id FROM users LIMIT 1`)) as any
      // defaultUserId = firstUser?.id || 1
      // console.log(`Using default userId: ${defaultUserId}`)
    }

    // ===== ページのシード =====
    console.log('Seeding database from .local/pages...')

    const pagesDir = path.resolve(process.cwd(), '.local/pages')
    if (!fs.existsSync(pagesDir)) {
      console.warn('Pages directory not found:', pagesDir)
      return { result: 'No pages found to seed' }
    }

    const titleMap = buildTitleMap(pagesDir)
    console.log(`Built title map with ${titleMap.size} entries.`)

    const files = getFilesRecursively(pagesDir)
    const pageEntries: Record<string, string | number | boolean | null>[] = []
    let bodyAstCount = 0

    for (const file of files.filter((file) => file.endsWith('.txt'))) {
      const relativePath = path
        .relative(pagesDir, file)
        .replace(/\.txt$/, '')
        .replace(/\\/g, '/')
      const bodyContent = fs.readFileSync(file, 'utf8')
      const markdown = convertDokuwikiToMarkdown(bodyContent, titleMap)
      const now = new Date().toISOString()

      const pagePath = relativePath === 'start' ? '/' : decodeLegacyPath(relativePath)
      const dbPath = pagePath.toLowerCase()
      const title =
        titleMap.get(dbPath) ||
        (relativePath === 'start' ? 'Home' : decodeLegacyPath(relativePath.split('/').pop() || ''))
      const bodyAst = await createBodyAstForSeed(markdown, pagePath)
      if (bodyAst) bodyAstCount++

      pageEntries.push({
        path: pagePath,
        title: title,
        revision: 1,
        body: markdown,
        bodyAst,
        message: null,
        minor: 0,
        created_at: now,
        updated_at: now,
        created_by: defaultUserId,
        updated_by: defaultUserId
      })
    }

    console.log(
      `Prepared ${bodyAstCount}/${pageEntries.length} page ASTs under ${BODY_AST_SOURCE_MAX_LENGTH} source chars and ${BODY_AST_JSON_MAX_LENGTH} AST chars.`
    )

    if (pageEntries.length > 0) {
      // ページテーブルのデータをすべて削除
      await db.run(sql`DELETE FROM pages`)

      // ページテーブルに挿入
      let pageCount = 0
      for (const pageEntry of pageEntries) {
        pageCount++
        if (pageCount % 100 === 0 || pageCount === pageEntries.length) {
          console.log(`[Pages] ${pageCount}/${pageEntries.length}: ${pageEntry.path}`)
        }
        try {
          const fullBody = pageEntry.body
          const bodyAst = pageEntry.bodyAst
          const insertPageEntry = { ...pageEntry }
          delete insertPageEntry.bodyAst

          if (typeof fullBody === 'string' && fullBody.length > D1_STATEMENT_CHUNK_SIZE) {
            // Raw INSERT for first chunk
            const firstChunk = fullBody.substring(0, D1_STATEMENT_CHUNK_SIZE)
            await rawInsert('pages', { ...insertPageEntry, body: firstChunk })

            // Raw UPDATE for subsequent chunks
            for (let offset = D1_STATEMENT_CHUNK_SIZE; offset < fullBody.length; offset += D1_STATEMENT_CHUNK_SIZE) {
              const chunk = fullBody.substring(offset, offset + D1_STATEMENT_CHUNK_SIZE)
              await db.run(sql`UPDATE pages SET body = body || ${chunk} WHERE path = ${pageEntry.path}`)
            }
            console.log(`[Large Page] Split and inserted: ${pageEntry.path} (${fullBody.length} chars)`)
          } else {
            await rawInsert('pages', insertPageEntry)
          }

          if (typeof bodyAst === 'string' && bodyAst.length > 0) {
            await db.run(sql`
              UPDATE pages
              SET body_ast = ${bodyAst}
              WHERE path = ${pageEntry.path} AND revision = ${pageEntry.revision}
            `)
          }
        } catch {
          console.error(`[Error] Failed to insert page: ${pageEntry.path}`)
        }
      }
      console.log(`Inserted ${pageEntries.length} pages.`)
    }

    // ===== コメントのシード =====
    let insertedCount = 0
    if (!onlyPages) {
      console.log('Seeding comments from .local/meta...')

      // コメントテーブルのデータをすべて削除
      await db.run(sql`DELETE FROM comments`)

      // CID → 新しい整数ID のマッピング
      const cidToNewId = new Map<string, number>()

      let commentProgress = 0
      for (const { pagePath, comment } of allComments) {
        commentProgress++
        if (commentProgress % 100 === 0 || commentProgress === allComments.length) {
          console.log(`[Comments] ${commentProgress}/${allComments.length}: ${pagePath}`)
        }

        const body = convertDokuwikiToMarkdown(comment.raw, titleMap)
        const createdAt = new Date(comment.date.created * 1000).toISOString()
        const updatedAt = comment.date.modified ? new Date(comment.date.modified * 1000).toISOString() : createdAt

        // 親コメントの新IDを取得
        const replyToId = comment.parent ? (cidToNewId.get(comment.parent) ?? null) : null
        const newUserId = oldUserIdToNewId.get(comment.user.id)

        if (newUserId === undefined) {
          console.warn(
            `[Warn] Skipping comment ${comment.cid} because user ${comment.user.id} not found in map. Mapping size: ${oldUserIdToNewId.size}`
          )
          continue
        }

        try {
          const res = (await db.get(sql`
            INSERT INTO comments (path, body, reply_to, user_id, created_at, updated_at)
            VALUES (${pagePath}, ${body}, ${replyToId}, ${newUserId}, ${createdAt}, ${updatedAt})
            ON CONFLICT DO NOTHING
            RETURNING id
          `)) as { id: number } | undefined

          const newId = Array.isArray(res) ? res[0] : res?.id
          if (newId) {
            cidToNewId.set(comment.cid, newId)
          }
          insertedCount++
        } catch (e: unknown) {
          console.error(
            `[Error] Failed to insert comment ${comment.cid} for ${pagePath}: ${e instanceof Error ? e.message : String(e)}`
          )
        }
      }
      console.log(`Inserted ${insertedCount} comments.`)
    }

    return {
      result: `Inserted ${pageEntries.length} pages and ${insertedCount} comments.`
    }
  }
})
