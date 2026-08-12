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
import { assertPageBaseRevision, getLatestPageRevision, insertPageRevision } from '~/server/utils/pageRevision'
import { requireApiUser } from '~/server/utils/authorization'
import { updatePageSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  const payload = await readZodBody(event, updatePageSchema)
  const { path, body, baseRevision } = payload
  const sanitizedBody = sanitizeDangerousMarkdownHtml(body)

  const latestRevision = await getLatestPageRevision(path)
  assertPageBaseRevision(baseRevision, latestRevision)

  const nextRevision = latestRevision + 1
  const now = new Date().toISOString()

  // Markdown を解析
  const ast = await parseMarkdown(sanitizedBody, mdcParseOptions)

  const title = extractTitleFromMarkdown(sanitizedBody) || (path === '/' ? 'Home' : path.split('/').pop() || path)

  const inserted = await insertPageRevision({
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

  await replacePageSearchIndex(inserted)
  await invalidateLatestPageCache(path)
  await invalidateRecentPagesCache()
  await invalidateRecentCommentsCache()
  await purgeWorkersCache(event, getPageMutationWorkersCachePurgeOptions(path))
  await purgeCdnByPrefixes(getPageMutationPurgePrefixes())

  return inserted
})
