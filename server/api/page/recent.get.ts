import { pagesTable } from '../../db/schema'
import { eq, desc, and, or, isNull, aliasedTable, gt, notExists, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseLimit(query.limit)
  const page = parsePositiveInteger(query.page, 1)
  const offset = (page - 1) * limit
  const includeMinor = query.includeMinor === 'true'

  const newerRevision = aliasedTable(pagesTable, 'newer_revision')
  const newerVisibleRevision = aliasedTable(pagesTable, 'newer_visible_revision')
  const newerDeletedRevision = aliasedTable(pagesTable, 'newer_deleted_revision')

  const visiblePage = sql`${pagesTable.body} != ''`
  const majorRevision = or(isNull(pagesTable.minor), eq(pagesTable.minor, 0))

  const whereClause = includeMinor
    ? and(
        visiblePage,
        notExists(
          db
            .select({ one: sql`1` })
            .from(newerRevision)
            .where(and(eq(newerRevision.path, pagesTable.path), gt(newerRevision.revision, pagesTable.revision)))
        )
      )
    : and(
        visiblePage,
        majorRevision,
        notExists(
          db
            .select({ one: sql`1` })
            .from(newerVisibleRevision)
            .where(
              and(
                eq(newerVisibleRevision.path, pagesTable.path),
                gt(newerVisibleRevision.revision, pagesTable.revision),
                sql`${newerVisibleRevision.body} != ''`,
                or(isNull(newerVisibleRevision.minor), eq(newerVisibleRevision.minor, 0))
              )
            )
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(newerDeletedRevision)
            .where(
              and(
                eq(newerDeletedRevision.path, pagesTable.path),
                gt(newerDeletedRevision.revision, pagesTable.revision),
                eq(newerDeletedRevision.body, '')
              )
            )
        )
      )

  const [countResult, data] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(pagesTable).where(whereClause).get(),
    db
      .select({
        path: pagesTable.path,
        title: pagesTable.title,
        revision: pagesTable.revision,
        message: pagesTable.message,
        updatedBy: pagesTable.updatedBy,
        updatedAt: pagesTable.updatedAt
      })
      .from(pagesTable)
      .where(whereClause)
      .orderBy(desc(pagesTable.updatedAt))
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
