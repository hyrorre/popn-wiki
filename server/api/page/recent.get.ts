import { pagesTable } from '../../db/schema'
import { eq, desc, and, or, isNull, aliasedTable, gt, notExists, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { getRecentPagesCacheKey, getRecentPagesCacheVersion, RECENT_PAGES_TTL } from '~/server/utils/recentPagesCache'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseLimit(query.limit)
  const page = parsePositiveInteger(query.page, 1)
  const offset = (page - 1) * limit
  const includeMinor = query.includeMinor === 'true'

  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'CDN-Cache-Control', 'public, max-age=60')

  const version = await getRecentPagesCacheVersion()
  const cacheKey = getRecentPagesCacheKey({ limit, page, includeMinor }, version)
  const cached = await useStorage('cache').getItem(cacheKey)
  if (cached) return cached

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

  const countSubquery = includeMinor
    ? db
        .select({ path: pagesTable.path })
        .from(pagesTable)
        .groupBy(pagesTable.path)
        .having(
          and(
            sql`max(case when ${pagesTable.body} != '' then ${pagesTable.revision} end) is not null`,
            sql`max(case when ${pagesTable.body} != '' then ${pagesTable.revision} end) = max(${pagesTable.revision})`
          )
        )
        .as('active_pages')
    : db
        .select({ path: pagesTable.path })
        .from(pagesTable)
        .groupBy(pagesTable.path)
        .having(
          and(
            sql`max(case when ${pagesTable.body} != '' and (${pagesTable.minor} is null or ${pagesTable.minor} = 0) then ${pagesTable.revision} end) is not null`,
            sql`coalesce(max(case when ${pagesTable.body} = '' then ${pagesTable.revision} end), -1) < max(case when ${pagesTable.body} != '' and (${pagesTable.minor} is null or ${pagesTable.minor} = 0) then ${pagesTable.revision} end)`
          )
        )
        .as('active_pages')

  const [countResult, data] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(countSubquery).get(),
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

  const result = { data, total: countResult?.count ?? 0 }
  event.waitUntil(useStorage('cache').setItem(cacheKey, result, { ttl: RECENT_PAGES_TTL }))
  return result
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
