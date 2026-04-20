import { pagesTable } from '../../db/schema'
import { eq, desc, and, or, isNull, aliasedTable, gt, notExists, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseLimit(query.limit)
  const includeMinor = query.includeMinor === 'true'

  const newerRevision = aliasedTable(pagesTable, 'newer_revision')
  const newerVisibleRevision = aliasedTable(pagesTable, 'newer_visible_revision')
  const newerDeletedRevision = aliasedTable(pagesTable, 'newer_deleted_revision')

  const visiblePage = sql`${pagesTable.body} != ''`
  const majorRevision = or(isNull(pagesTable.minor), eq(pagesTable.minor, 0))

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
    .where(
      includeMinor
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
    )
    .orderBy(desc(pagesTable.updatedAt))
    .limit(limit)
    .all()

  return data
})

function parseLimit(value: unknown) {
  const limit = Number(value)

  if (!Number.isFinite(limit)) {
    return 10
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 50)
}
