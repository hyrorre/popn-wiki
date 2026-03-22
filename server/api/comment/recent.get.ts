import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 10, 50)

  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('comments')
    .select('path, created_at, profiles:user_id(name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  // 各パスの最新コメントだけを残す
  const seen = new Set<string>()
  const recent: { path: string; created_at: string; commenter: string }[] = []

  for (const row of data ?? []) {
    if (seen.has(row.path)) continue
    seen.add(row.path)
    const profile = row.profiles as unknown as { name: string } | null
    recent.push({
      path: row.path,
      created_at: row.created_at,
      commenter: profile?.name ?? '匿名'
    })
    if (recent.length >= limit) break
  }

  return recent
})
