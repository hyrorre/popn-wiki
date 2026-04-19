/**
 * Markdown 本文からページタイトルを抽出する
 * # Title や # [Title]{.class} の形式に対応
 */
export function extractTitleFromMarkdown(body: string): string | null {
  const titleMatch = body.match(/^#{1,6}\s+(.*)$/m)
  if (!titleMatch) return null

  let title = titleMatch[1]?.trim()
  // [タイトル]{.hoge} 形式のクリーンアップ
  const cleanMatch = title?.match(/^\[(.*?)\]\{.*?\}$/)
  if (cleanMatch) {
    title = cleanMatch[1]?.trim()
  }

  return title ?? null
}
