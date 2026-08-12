import { pagesTable } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { mdcParseOptions } from '../../utils/markdown'
import { invalidateLatestPageCache } from '../../utils/pageCache'
import { invalidateRecentPagesCache } from '../../utils/recentPagesCache'
import { invalidateRecentCommentsCache } from '../../utils/recentCommentsCache'
import { getPageMutationPurgePrefixes, purgeCdnByPrefixes } from '../../utils/cfCachePurge'
import { replacePageSearchIndex } from '../../utils/pageSearchIndex'
import { getPageMutationWorkersCachePurgeOptions, purgeWorkersCache } from '../../utils/workersCache'
import { readZodBody } from '~/server/utils/validation'
import { restorePageSchema } from '~/shared/zod'
import { assertPageBaseRevision, getLatestPageRevision, insertPageRevision } from '~/server/utils/pageRevision'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const { path, targetRevision, baseRevision } = await readZodBody(event, restorePageSchema)

  const targetPage = await db
    .select()
    .from(pagesTable)
    .where(and(eq(pagesTable.path, path), eq(pagesTable.revision, targetRevision)))
    .get()

  if (!targetPage) {
    throw createError({ statusCode: 404, message: 'Target revision not found.' })
  }

  const latestRevision = await getLatestPageRevision(path)
  const nextRevision = latestRevision + 1
  assertPageBaseRevision(baseRevision, latestRevision)

  const now = new Date().toISOString()

  // 復元対象のページ本文を再解析（あるいは元データに AST があればそれを使っても良いが
  // スキーマ変更前のデータには AST がないので再解析するのが安全）
  const ast = await parseMarkdown(targetPage.body, mdcParseOptions)

  const inserted = await insertPageRevision({
    path,
    title: targetPage.title,
    revision: nextRevision,
    body: targetPage.body,
    bodyAst: JSON.stringify(ast),
    message: `Restore revision ${targetRevision}`,
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
    updatedBy: user.id
  })

  await replacePageSearchIndex(inserted)
  await invalidateLatestPageCache(path)
  await invalidateRecentPagesCache()
  await invalidateRecentCommentsCache()
  await purgeWorkersCache(event, getPageMutationWorkersCachePurgeOptions(path))
  await purgeCdnByPrefixes(getPageMutationPurgePrefixes())

  return inserted
})
