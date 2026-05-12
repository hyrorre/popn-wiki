import { commentsTable, usersTable, pagesTable } from '../../db/schema'
import { eq, desc, isNull, and, or, gt, aliasedTable, notExists, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseLimit(query.limit)
  const page = parsePositiveInteger(query.page, 1)
  const offset = (page - 1) * limit

  const newerComment = aliasedTable(commentsTable, 'newer_comment')
  const newerPage = aliasedTable(pagesTable, 'newer_page')
  const latestPages = db
    .select({
      path: pagesTable.path,
      title: pagesTable.title,
      revision: pagesTable.revision
    })
    .from(pagesTable)
    .where(
      and(
        sql`${pagesTable.body} != ''`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(newerPage)
            .where(and(eq(newerPage.path, pagesTable.path), gt(newerPage.revision, pagesTable.revision)))
        )
      )
    )
    .as('latest_pages')

  const whereClause = and(
    isNull(commentsTable.deletedAt),
    notExists(
      db
        .select({ one: sql`1` })
        .from(newerComment)
        .where(
          and(
            eq(newerComment.path, commentsTable.path),
            or(
              gt(newerComment.createdAt, commentsTable.createdAt),
              and(eq(newerComment.createdAt, commentsTable.createdAt), gt(newerComment.id, commentsTable.id))
            ),
            isNull(newerComment.deletedAt)
          )
        )
    )
  )

  const [countResult, data] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(commentsTable).where(whereClause).get(),
    db
      .select({
        path: commentsTable.path,
        title: latestPages.title,
        created_at: commentsTable.createdAt,
        commenter: sql<string>`coalesce(${usersTable.name}, '匿名')`
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .leftJoin(latestPages, eq(commentsTable.path, latestPages.path))
      .where(whereClause)
      .orderBy(desc(commentsTable.createdAt))
      .limit(limit)
      .offset(offset)
      .all()
  ])

  return { data, total: countResult?.count ?? 0 }
})

function parseLimit(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 10
  return Math.min(Math.max(Math.trunc(n), 1), 50)
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.trunc(n)
}
