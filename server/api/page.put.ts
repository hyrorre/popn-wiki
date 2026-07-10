import { pagesTable } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { extractTitleFromMarkdown } from '../utils/page'
import { invalidateLatestPageCache } from '../utils/pageCache'
import { invalidateRecentPagesCache } from '../utils/recentPagesCache'
import { invalidateRecentCommentsCache } from '../utils/recentCommentsCache'
import { getPageMutationPurgePrefixes, purgeCdnByPrefixes } from '../utils/cfCachePurge'
import { replacePageSearchIndex } from '../utils/pageSearchIndex'
import { getPageMutationWorkersCachePurgeOptions, purgeWorkersCache } from '../utils/workersCache'
import { readZodBody } from '~/server/utils/validation'
import { sanitizeDangerousMarkdownHtml, mdcParseOptions } from '~/server/utils/markdown'
import { updatePageSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readZodBody(event, updatePageSchema)
  const { path, body, baseRevision } = payload
  const sanitizedBody = sanitizeDangerousMarkdownHtml(body)

  const latest = await db
    .select()
    .from(pagesTable)
    .where(eq(pagesTable.path, path))
    .orderBy(desc(pagesTable.revision))
    .get()

  const latestRevision = latest?.revision ?? 0
  if (baseRevision !== latestRevision) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Revision conflict.',
      data: { latestRevision }
    })
  }

  const nextRevision = latestRevision + 1
  const now = new Date().toISOString()

  // Markdown を解析
  const ast = await parseMarkdown(sanitizedBody, mdcParseOptions)

  const title = extractTitleFromMarkdown(sanitizedBody) || (path === '/' ? 'Home' : path.split('/').pop() || path)

  const inserted = await db
    .insert(pagesTable)
    .values({
      path,
      title,
      revision: nextRevision,
      body: sanitizedBody,
      bodyAst: JSON.stringify(ast),
      message: payload.message?.trim() || null,
      minor: payload.minor ?? 0,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()
    .get()

  await replacePageSearchIndex(inserted)
  await invalidateLatestPageCache(path)
  await invalidateRecentPagesCache()
  await invalidateRecentCommentsCache()
  await purgeWorkersCache(event, getPageMutationWorkersCachePurgeOptions(path))
  await purgeCdnByPrefixes(getPageMutationPurgePrefixes())

  return inserted
})
