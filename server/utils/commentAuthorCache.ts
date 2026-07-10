import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { commentsTable } from '~/server/db/schema'
import { invalidateCommentListCache } from '~/server/utils/commentCache'
import { invalidateRecentCommentsCache } from '~/server/utils/recentCommentsCache'
import { getCommentMutationPurgePrefixes, purgeCdnByPrefixes } from '~/server/utils/cfCachePurge'
import { getCommentMutationWorkersCachePurgeOptions, purgeWorkersCache } from '~/server/utils/workersCache'

export async function getCommentPathsByUser(userId: number) {
  const rows = await db
    .select({ path: commentsTable.path })
    .from(commentsTable)
    .where(eq(commentsTable.userId, userId))
    .groupBy(commentsTable.path)
    .all()

  return rows.map((row) => row.path)
}

export async function invalidateCommentAuthorCaches(event: H3Event, paths: string[]): Promise<boolean> {
  const uniquePaths = [...new Set(paths)]
  if (uniquePaths.length === 0) {
    return true
  }

  let success = true

  const internalResults = await Promise.allSettled([
    ...uniquePaths.map((path) => invalidateCommentListCache(path)),
    invalidateRecentCommentsCache()
  ])
  const internalErrors = internalResults
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => getErrorMessage(result.reason))

  if (internalErrors.length > 0) {
    console.warn(`[CommentAuthorCache] Failed to invalidate internal caches: ${internalErrors.join('; ')}`)
    success = false
  }

  if (!(await purgeWorkersCache(event, getCommentMutationWorkersCachePurgeOptions(uniquePaths)))) {
    success = false
  }

  if (!(await purgeCdnByPrefixes(getCommentMutationPurgePrefixes()))) {
    success = false
  }

  return success
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
