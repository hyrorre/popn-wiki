import { commentsTable, usersTable, pagesTable } from '../../db/schema'
import { eq, desc, isNull, and, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import {
  getRecentCommentsCacheKey,
  getRecentCommentsCacheVersion,
  RECENT_COMMENTS_TTL
} from '~/server/utils/recentCommentsCache'
import { CDN_CACHE_TTL, setPublicCdnCacheHeaders } from '~/server/utils/cacheHeaders'
import { getRecentCommentsWorkersCacheTags, setWorkersCacheTags } from '~/server/utils/workersCache'
import { parseClampedInteger, parseIntegerOrFallback } from '~/server/utils/queryInteger'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseClampedInteger(query.limit, { fallback: 10, minimum: 1, maximum: 50 })
  const page = parseIntegerOrFallback(query.page, { fallback: 1, minimum: 1 })
  const offset = (page - 1) * limit

  const version = await getRecentCommentsCacheVersion()
  const cacheKey = getRecentCommentsCacheKey({ limit, page }, version)
  const cached = await useStorage('cache').getItem(cacheKey)
  if (cached) {
    setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.recentList)
    setWorkersCacheTags(event, getRecentCommentsWorkersCacheTags())
    return cached
  }

  // path ごとの最新コメントID（NOT EXISTS 相関サブクエリを GROUP BY + MAX に変更）
  const latestCommentPerPath = db
    .select({
      path: commentsTable.path,
      maxId: sql<number>`max(${commentsTable.id})`.as('max_id')
    })
    .from(commentsTable)
    .where(isNull(commentsTable.deletedAt))
    .groupBy(commentsTable.path)
    .as('latest_comment_per_path')

  // path ごとの最新ページリビジョン（SQLite の bare column 挙動で MAX(revision) 行の title が取れる）
  const latestPages = db
    .select({
      path: pagesTable.path,
      title: pagesTable.title,
      _rev: sql<number>`max(${pagesTable.revision})`
    })
    .from(pagesTable)
    .where(sql`${pagesTable.body} != ''`)
    .groupBy(pagesTable.path)
    .as('latest_pages')

  // count(*) OVER () でページ総数を data クエリと同時取得（別途 count クエリ不要）
  const rows = await db
    .select({
      total: sql<number>`count(*) OVER ()`,
      path: commentsTable.path,
      title: latestPages.title,
      created_at: commentsTable.createdAt,
      commenter: sql<string>`coalesce(${usersTable.name}, '匿名')`
    })
    .from(commentsTable)
    .innerJoin(
      latestCommentPerPath,
      and(eq(commentsTable.path, latestCommentPerPath.path), eq(commentsTable.id, latestCommentPerPath.maxId))
    )
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .leftJoin(latestPages, eq(commentsTable.path, latestPages.path))
    .orderBy(desc(commentsTable.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  const total = rows[0]?.total ?? 0
  const data = rows.map(({ total: _, ...rest }) => rest)
  const result = { data, total }
  event.waitUntil(useStorage('cache').setItem(cacheKey, result, { ttl: RECENT_COMMENTS_TTL }))
  setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.recentList)
  setWorkersCacheTags(event, getRecentCommentsWorkersCacheTags())
  return result
})
