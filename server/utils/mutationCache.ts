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

type CacheInvalidationOperation = {
  name: string
  run: () => Promise<unknown>
}

export async function invalidatePageMutationCaches(event: H3Event, path: string): Promise<boolean> {
  return runBestEffortCacheInvalidations('PageMutationCache', [
    { name: 'latest page cache', run: () => invalidateLatestPageCache(path) },
    { name: 'recent pages cache', run: () => invalidateRecentPagesCache() },
    { name: 'recent comments cache', run: () => invalidateRecentCommentsCache() },
    {
      name: 'Workers Cache',
      run: () => purgeWorkersCache(event, getPageMutationWorkersCachePurgeOptions(path))
    },
    { name: 'CDN cache', run: () => purgeCdnByPrefixes(getPageMutationPurgePrefixes()) }
  ])
}

export async function invalidateCommentMutationCaches(
  event: H3Event,
  path: string,
  mutation: 'create' | 'update' | 'delete'
): Promise<boolean> {
  return runBestEffortCacheInvalidations('CommentMutationCache', [
    { name: 'comment list cache', run: () => invalidateCommentListCache(path) },
    ...(mutation === 'update'
      ? []
      : [{ name: 'recent comments cache', run: () => invalidateRecentCommentsCache() }]),
    { name: 'external comment caches', run: () => purgeCommentMutationExternalCaches(event, path) }
  ])
}

export async function purgeCommentMutationExternalCaches(event: H3Event, paths: string | string[]) {
  return runBestEffortCacheInvalidations('CommentExternalCache', [
    {
      name: 'Workers Cache',
      run: () => purgeWorkersCache(event, getCommentMutationWorkersCachePurgeOptions(paths))
    },
    { name: 'CDN cache', run: () => purgeCdnByPrefixes(getCommentMutationPurgePrefixes()) }
  ])
}

export async function runBestEffortCacheInvalidations(
  scope: string,
  operations: CacheInvalidationOperation[]
): Promise<boolean> {
  const results = await Promise.allSettled(operations.map((operation) => operation.run()))
  const failures = results.flatMap((result, index) => {
    if (result.status === 'rejected') {
      return [`${operations[index]?.name}: ${getErrorMessage(result.reason)}`]
    }

    return result.value === false ? [operations[index]?.name ?? 'unknown'] : []
  })

  if (failures.length > 0) {
    console.warn(`[${scope}] Cache invalidation did not fully succeed: ${failures.join('; ')}`)
    return false
  }

  return true
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
