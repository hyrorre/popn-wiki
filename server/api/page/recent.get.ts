import { serverSupabaseClient } from '#supabase/server'
import type { Page } from '~/types'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 10, 50)

  const client = await serverSupabaseClient(event)

  // 各ページの最新リビジョンのみ取得するため、
  // distinct on は Supabase JS では直接使えないので、全最新をソートで取得してフィルタする
  const { data, error } = await client
    .from('pages')
    .select('path, revision, message, updated_by, updated_at')
    .neq('body', '')  // 削除済みページを除外
    .order('updated_at', { ascending: false })
    .limit(200)  // 十分な候補を取得

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  // 各パスの最新リビジョンだけを残す
  const seen = new Set<string>()
  const recent: Pick<Page, 'path' | 'revision' | 'message' | 'updated_by' | 'updated_at'>[] = []

  for (const row of data ?? []) {
    if (seen.has(row.path)) continue
    seen.add(row.path)
    recent.push(row)
    if (recent.length >= limit) break
  }

  return recent
})
