import { commentsTable, usersTable, pagesTable } from '../db/schema'
import { eq, desc, and, isNull, sql, ne, aliasedTable, inArray } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const query = getQuery(event)
  const type = (query.type as string) || 'direct'
  const limit = Math.min(Number(query.limit) || 20, 100)
  const offset = Number(query.offset) || 0

  let replyIds: number[] = []

  if (type === 'direct') {
    // 1. 自分への直接返信
    const myComments = aliasedTable(commentsTable, 'my_comments')
    const results = await db
      .select({ id: commentsTable.id })
      .from(commentsTable)
      .innerJoin(myComments, eq(commentsTable.replyTo, myComments.id))
      .where(
        and(
          eq(myComments.userId, userId),
          ne(commentsTable.userId, userId),
          isNull(commentsTable.deletedAt)
        )
      )
      .orderBy(desc(commentsTable.createdAt))
      .limit(limit)
      .offset(offset)
      .all()
    replyIds = results.map((r) => r.id)
  } else {
    // 2. 自分が参加しているスレッドへの返信
    // 再帰的クエリで各コメントをルートIDに関連付ける
    const hierarchy = db.$with('hierarchy').as(
      db
        .select({
          id: sql`id`.as('id'),
          root_id: sql`id`.as('root_id'),
          user_id: sql`user_id`.as('user_id')
        })
        .from(commentsTable)
        .where(isNull(commentsTable.replyTo))
        .unionAll(
          db
            .select({
              id: sql`comments.id`,
              root_id: sql`hierarchy.root_id`,
              user_id: sql`comments.user_id`
            })
            .from(commentsTable)
            .innerJoin(sql`hierarchy`, eq(commentsTable.replyTo, sql`hierarchy.id`))
        )
    )

    // 自分が参加しているルートIDを特定
    const myRoots = await db
      .with(hierarchy)
      .select({ rootId: sql<number>`hierarchy.root_id` })
      .from(hierarchy)
      .where(eq(sql`hierarchy.user_id`, userId))
      .groupBy(sql`hierarchy.root_id`)
      .all()

    const rootIds = myRoots.map((r) => r.rootId)

    if (rootIds.length > 0) {
      const results = await db
        .with(hierarchy)
        .select({ id: sql<number>`hierarchy.id` })
        .from(hierarchy)
        .innerJoin(commentsTable, eq(sql`hierarchy.id`, commentsTable.id))
        .where(
          and(
            inArray(sql`hierarchy.root_id`, rootIds),
            ne(sql`hierarchy.user_id`, userId),
            isNull(commentsTable.deletedAt)
          )
        )
        .orderBy(desc(commentsTable.createdAt))
        .limit(limit)
        .offset(offset)
        .all()
      replyIds = results.map((r) => r.id)
    }
  }

  if (replyIds.length === 0) {
    return []
  }

  // 詳細情報を取得（ページタイトル、ユーザー名など）
  // ページタイトルは最新のレビジョンから取得
  const latestPages = db
    .select({
      path: pagesTable.path,
      title: pagesTable.title,
      maxRev: sql`MAX(revision)`.as('max_rev')
    })
    .from(pagesTable)
    .groupBy(pagesTable.path)
    .as('latest_pages')

  const replies = await db
    .select({
      id: commentsTable.id,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
      path: commentsTable.path,
      pageTitle: latestPages.title,
      userName: usersTable.name
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .leftJoin(latestPages, eq(commentsTable.path, latestPages.path))
    .where(inArray(commentsTable.id, replyIds))
    .orderBy(desc(commentsTable.createdAt))
    .all()

  // 本文をプレビュー用に加工（簡易的な短縮）
  return replies.map((r) => ({
    ...r,
    bodyPreview: r.body.length > 100 ? `${r.body.substring(0, 100)}...` : r.body
  }))
})
