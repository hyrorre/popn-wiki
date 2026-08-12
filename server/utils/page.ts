/**
 * Markdown 本文からページタイトルを抽出する
 * # Title や # [Title]{.class} の形式に対応
 */
export function extractTitleFromMarkdown(body: string): string | null {
  let fence: { marker: string; length: number } | null = null

  for (const line of body.split(/\r?\n/)) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (fenceMatch) {
      const sequence = fenceMatch[1] as string
      const marker = sequence[0] as string
      const suffix = fenceMatch[2] as string

      if (!fence) {
        fence = { marker, length: sequence.length }
        continue
      }

      if (marker === fence.marker && sequence.length >= fence.length && suffix.trim() === '') {
        fence = null
      }
      continue
    }

    if (fence) continue

    const titleMatch = line.match(/^#{1,6}\s+(.*)$/)
    if (!titleMatch) continue

    let title = titleMatch[1]?.trim()
    // [タイトル]{.hoge} 形式のクリーンアップ
    const cleanMatch = title?.match(/^\[(.*?)\]\{.*?\}$/)
    if (cleanMatch) {
      title = cleanMatch[1]?.trim()
    }

    return title ?? null
  }

  return null
}

export function resolvePageTitle(body: string, path: string) {
  return extractTitleFromMarkdown(body) || (path === '/' ? 'Home' : path.split('/').pop() || path)
}
