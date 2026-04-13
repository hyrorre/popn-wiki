import { pagesTable } from '../../db/schema'
import { eq, desc, not } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 10, 50)

  // 各ページの最新リビジョンを取得
  // SQLite では WINDOW FUNCTION や SUBQUERY を使用
  const data = await db
    .select({
      path: pagesTable.path,
      title: pagesTable.title,
      revision: pagesTable.revision,
      message: pagesTable.message,
      updatedBy: pagesTable.updatedBy,
      updatedAt: pagesTable.updatedAt
    })
    .from(pagesTable)
    .where(not(eq(pagesTable.body, ''))) // 削除済みを除外
    .orderBy(desc(pagesTable.updatedAt))
    .all()

  // 重複排除 (メモリ上で行うのが簡単)
  const seen = new Set<string>()
  const recent = []

  for (const row of data) {
    if (seen.has(row.path)) continue
    seen.add(row.path)
    recent.push(row)
    if (recent.length >= limit) break
  }

  return recent
})
