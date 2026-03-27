import { commentsTable, profilesTable } from '../db/schema'
import { eq, asc } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path as string

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  // Join を使用してプロフィール名を取得
  const data = await db
    .select({
      id: commentsTable.id,
      path: commentsTable.path,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
      updatedAt: commentsTable.updatedAt,
      userId: commentsTable.userId,
      profiles: {
        id: profilesTable.id,
        name: profilesTable.name
      }
    })
    .from(commentsTable)
    .leftJoin(profilesTable, eq(commentsTable.userId, profilesTable.id))
    .where(eq(commentsTable.path, path))
    .orderBy(asc(commentsTable.createdAt))
    .all()

  // フロントエンドが期待する形式（profiles がネストされたオブジェクト）に変換
  // Drizzle の select でも構造化できますが、一旦手動で整形
  return data
})
