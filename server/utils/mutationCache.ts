import type { H3Event } from 'h3'
import { invalidateCommentListCache } from '~/server/utils/commentCache'
import { invalidateLatestPageCache } from '~/server/utils/pageCache'
import { invalidateRecentCommentsCache } from '~/server/utils/recentCommentsCache'
import { invalidateRecentPagesCache } from '~/server/utils/recentPagesCache'
import {
  getCommentMutationPurgePrefixes,
  getPageMutationPurgePrefixes,
  purgeCdnByPrefixes
} from '~/server/utils/cfCachePurge'
import {
  getCommentMutationWorkersCachePurgeOptions,
  getPageMutationWorkersCachePurgeOptions,
  purgeWorkersCache
} from '~/server/utils/workersCache'

export async function invalidatePageMutationCaches(event: H3Event, path: string) {
  await invalidateLatestPageCache(path)
  await invalidateRecentPagesCache()
  await invalidateRecentCommentsCache()
  await purgeWorkersCache(event, getPageMutationWorkersCachePurgeOptions(path))
  await purgeCdnByPrefixes(getPageMutationPurgePrefixes())
}

export async function invalidateCommentMutationCaches(
  event: H3Event,
  path: string,
  mutation: 'create' | 'update' | 'delete'
) {
  await invalidateCommentListCache(path)
  if (mutation !== 'update') {
    await invalidateRecentCommentsCache()
  }
  await purgeCommentMutationExternalCaches(event, path)
}

export async function purgeCommentMutationExternalCaches(event: H3Event, paths: string | string[]) {
  const workersCachePurged = await purgeWorkersCache(event, getCommentMutationWorkersCachePurgeOptions(paths))
  const cdnPurged = await purgeCdnByPrefixes(getCommentMutationPurgePrefixes())
  return workersCachePurged && cdnPurged
}
