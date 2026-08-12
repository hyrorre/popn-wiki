import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { commentsTable } from '~/server/db/schema'
import { invalidateCommentListCache } from '~/server/utils/commentCache'
import { invalidateRecentCommentsCache } from '~/server/utils/recentCommentsCache'
import { purgeCommentMutationExternalCaches, runBestEffortCacheInvalidations } from '~/server/utils/mutationCache'

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

  return runBestEffortCacheInvalidations('CommentAuthorCache', [
    ...uniquePaths.map((path) => ({
      name: `comment list cache (${path})`,
      run: () => invalidateCommentListCache(path)
    })),
    { name: 'recent comments cache', run: () => invalidateRecentCommentsCache() },
    {
      name: 'external comment caches',
      run: () => purgeCommentMutationExternalCaches(event, uniquePaths)
    }
  ])
}
