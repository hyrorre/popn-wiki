import { db } from '@nuxthub/db'
import { aliasedTable, and, eq, gt, notExists, sql } from 'drizzle-orm'
import type { SitemapUrlInput } from '@nuxtjs/sitemap'
import { pagesTable } from '../db/schema'
import { CDN_CACHE_TTL, setPublicCdnCacheHeaders } from '~/server/utils/cacheHeaders'
import { getSitemapWorkersCacheTags, setWorkersCacheTags } from '~/server/utils/workersCache'

export default defineSitemapEventHandler(async (event): Promise<SitemapUrlInput[]> => {
  setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.sitemap)
  setWorkersCacheTags(event, getSitemapWorkersCacheTags())

  const newerRevision = aliasedTable(pagesTable, 'newer_revision')

  const pages = await db
    .select({
      path: pagesTable.path,
      updatedAt: pagesTable.updatedAt
    })
    .from(pagesTable)
    .where(
      and(
        sql`${pagesTable.body} != ''`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(newerRevision)
            .where(and(eq(newerRevision.path, pagesTable.path), gt(newerRevision.revision, pagesTable.revision)))
        )
      )
    )
    .all()

  return pages.map((page) =>
    asSitemapUrl({
      loc: normalizePageLoc(page.path),
      lastmod: page.updatedAt
    })
  )
})

function normalizePageLoc(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}
