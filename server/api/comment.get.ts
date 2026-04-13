import { db } from '@nuxthub/db'
import { aliasedTable, and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { commentsTable, usersTable } from '../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path as string
  const page = Math.max(1, parseInt((query.page as string) || '1', 10))
  const limit = Math.max(1, parseInt((query.limit as string) || '20', 10))
  const offset = (page - 1) * limit

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  // 1. 親コメント（ルート）の総数を取得
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(commentsTable)
    .where(and(eq(commentsTable.path, path), isNull(commentsTable.replyTo)))
    .get()
  const total = countResult?.count ?? 0

  if (total === 0) {
    return { comments: [], total: 0 }
  }

  // 2. 現在のページの親コメントIDを取得 (最新のスレッドを先に表示するため降順)
  const rootIdsResult = await db
    .select({ id: commentsTable.id })
    .from(commentsTable)
    .where(and(eq(commentsTable.path, path), isNull(commentsTable.replyTo)))
    .orderBy(desc(commentsTable.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  const rootIds = rootIdsResult.map((r) => r.id)

  if (rootIds.length === 0) {
    return { comments: [], total }
  }

  // 3. 再帰的クエリ (Recursive CTE) で親 ID に紐づくすべての子孫を取得
  // スレッド内は昇順、スレッド間は降順にするため rootCreatedAt も保持する
  const tree = db.$with('tree').as(
    db
      .select({
        id: commentsTable.id,
        path: commentsTable.path,
        body: commentsTable.body,
        replyTo: commentsTable.replyTo,
        userId: commentsTable.userId,
        createdAt: commentsTable.createdAt,
        updatedAt: commentsTable.updatedAt,
        rootCreatedAt: sql<string>`${commentsTable.createdAt}`.as('rootCreatedAt')
      })
      .from(commentsTable)
      .where(inArray(commentsTable.id, rootIds))
      .unionAll(
        db
          .select({
            id: commentsTable.id,
            path: commentsTable.path,
            body: commentsTable.body,
            replyTo: commentsTable.replyTo,
            userId: commentsTable.userId,
            createdAt: commentsTable.createdAt,
            updatedAt: commentsTable.updatedAt,
            rootCreatedAt: sql<string>`tree.rootCreatedAt`.as('rootCreatedAt')
          })
          .from(commentsTable)
          .innerJoin(sql`tree`, eq(commentsTable.replyTo, sql`tree.id`))
      )
  )

  // 親コメントのプロフィール名を取得するためのエイリアス（返信先表示用）
  const parentComments = aliasedTable(commentsTable, 'parent_comments')
  const parentProfiles = aliasedTable(usersTable, 'parent_profiles')

  // tree CTE から結果を取得し、プロフィールを JOIN
  const comments = await db
    .with(tree)
    .select({
      id: tree.id,
      path: tree.path,
      body: tree.body,
      createdAt: tree.createdAt,
      updatedAt: tree.updatedAt,
      userId: tree.userId,
      replyTo: tree.replyTo,
      profiles: {
        id: usersTable.id,
        name: usersTable.name
      },
      replyToName: parentProfiles.name
    })
    .from(tree)
    .leftJoin(usersTable, eq(tree.userId, usersTable.id))
    .leftJoin(parentComments, eq(tree.replyTo, parentComments.id))
    .leftJoin(parentProfiles, eq(parentComments.userId, parentProfiles.id))
    .orderBy(desc(sql`tree.rootCreatedAt`), asc(tree.createdAt))
    .all()

  return {
    comments,
    total
  }
})
