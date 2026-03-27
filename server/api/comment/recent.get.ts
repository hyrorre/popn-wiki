import { commentsTable, profilesTable } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 10, 50)

  // Drizzle Join を使用してプロフィール名を取得
  const data = await db
    .select({
      path: commentsTable.path,
      createdAt: commentsTable.createdAt,
      name: profilesTable.name
    })
    .from(commentsTable)
    .leftJoin(profilesTable, eq(commentsTable.userId, profilesTable.id))
    .orderBy(desc(commentsTable.createdAt))
    .limit(200)
    .all()

  const seen = new Set<string>()
  const recent = []

  for (const row of data) {
    if (seen.has(row.path)) continue
    seen.add(row.path)
    recent.push({
      path: row.path,
      created_at: row.createdAt,
      commenter: row.name ?? '匿名'
    })
    if (recent.length >= limit) break
  }

  return recent
})
