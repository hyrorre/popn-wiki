import { invalidateLatestPageCache } from '../utils/pageCache'
import { invalidateRecentPagesCache } from '../utils/recentPagesCache'
import { invalidateRecentCommentsCache } from '../utils/recentCommentsCache'
import { getPageMutationPurgePrefixes, purgeCdnByPrefixes } from '../utils/cfCachePurge'
import { removePageSearchIndex } from '../utils/pageSearchIndex'
import { getPageMutationWorkersCachePurgeOptions, purgeWorkersCache } from '../utils/workersCache'
import { assertPageBaseRevision, getLatestPage, insertPageRevision } from '../utils/pageRevision'

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

  const latest = await getLatestPage(path)

  if (!latest || latest.body === '') {
    throw createError({ statusCode: 404, message: 'Page not found or already deleted.' })
  }

  assertPageBaseRevision(baseRevision, latest.revision)

  const nextRevision = latest.revision + 1
  const now = new Date().toISOString()

  const inserted = await insertPageRevision({
    path,
    revision: nextRevision,
    body: '',
    message: 'ページ削除',
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
    updatedBy: user.id
  })

  await removePageSearchIndex(path)
  await invalidateLatestPageCache(path)
  await invalidateRecentPagesCache()
  await invalidateRecentCommentsCache()
  await purgeWorkersCache(event, getPageMutationWorkersCachePurgeOptions(path))
  await purgeCdnByPrefixes(getPageMutationPurgePrefixes())

  return inserted
})
