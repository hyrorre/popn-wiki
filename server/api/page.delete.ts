import { pagesTable } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { invalidateLatestPageCache } from '../utils/pageCache'
import { invalidateRecentPagesCache } from '../utils/recentPagesCache'
import { invalidateRecentCommentsCache } from '../utils/recentCommentsCache'
import { getPageMutationPurgePrefixes, purgeCdnByPrefixes } from '../utils/cfCachePurge'
import { removePageSearchIndex } from '../utils/pageSearchIndex'
import { getPageMutationWorkersCachePurgeOptions, purgeWorkersCache } from '../utils/workersCache'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path.trim() : ''
  const baseRevision = Number(query.baseRevision)

  if (!path || !Number.isInteger(baseRevision) || baseRevision <= 0) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const latest = await db
    .select()
    .from(pagesTable)
    .where(eq(pagesTable.path, path))
    .orderBy(desc(pagesTable.revision))
    .get()

  if (!latest || latest.body === '') {
    throw createError({ statusCode: 404, message: 'Page not found or already deleted.' })
  }

  if (baseRevision !== latest.revision) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Revision conflict.',
      data: { latestRevision: latest.revision }
    })
  }

  const nextRevision = latest.revision + 1
  const now = new Date().toISOString()

  const inserted = await db
    .insert(pagesTable)
    .values({
      path,
      revision: nextRevision,
      body: '',
      message: 'ページ削除',
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id
    })
    .onConflictDoNothing({ target: [pagesTable.path, pagesTable.revision] })
    .returning()
    .get()

  if (!inserted) {
    const current = await db
      .select({ revision: pagesTable.revision })
      .from(pagesTable)
      .where(eq(pagesTable.path, path))
      .orderBy(desc(pagesTable.revision))
      .get()

    throw createError({
      statusCode: 409,
      statusMessage: 'Revision conflict.',
      data: { latestRevision: current?.revision ?? latest.revision }
    })
  }

  await removePageSearchIndex(path)
  await invalidateLatestPageCache(path)
  await invalidateRecentPagesCache()
  await invalidateRecentCommentsCache()
  await purgeWorkersCache(event, getPageMutationWorkersCachePurgeOptions(path))
  await purgeCdnByPrefixes(getPageMutationPurgePrefixes())

  return inserted
})
