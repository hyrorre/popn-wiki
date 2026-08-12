import { commentsTable, usersTable } from '../db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { invalidateCommentListCache } from '~/server/utils/commentCache'
import { invalidateRecentCommentsCache } from '~/server/utils/recentCommentsCache'
import { getCommentMutationPurgePrefixes, purgeCdnByPrefixes } from '~/server/utils/cfCachePurge'
import { getCommentMutationWorkersCachePurgeOptions, purgeWorkersCache } from '~/server/utils/workersCache'
import { readZodBody } from '~/server/utils/validation'
import { sanitizeDangerousMarkdownHtml, mdcParseOptions } from '~/server/utils/markdown'
import { createCommentSchema } from '~/shared/zod'
import { requireApiUser } from '~/server/utils/authorization'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'comment:post', limit: 10 })
  const user = await requireApiUser(event)

  const { path, body, replyTo } = await readZodBody(event, createCommentSchema)
  const sanitizedBody = sanitizeDangerousMarkdownHtml(body).trim()

  if (!sanitizedBody) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  if (replyTo !== null) {
    const parent = await db
      .select({
        id: commentsTable.id,
        path: commentsTable.path
      })
      .from(commentsTable)
      .where(and(eq(commentsTable.id, replyTo), isNull(commentsTable.deletedAt)))
      .get()

    if (!parent || parent.path !== path) {
      throw createError({ statusCode: 400, message: 'Invalid reply target.' })
    }
  }

  const now = new Date().toISOString()
  const ast = await parseMarkdown(sanitizedBody, mdcParseOptions)

  const inserted = await db
    .insert(commentsTable)
    .values({
      path,
      body: sanitizedBody,
      bodyAst: JSON.stringify(ast),
      replyTo,
      userId: user.id,
      createdAt: now,
      updatedAt: now
    })
    .returning()
    .get()

  // プロフィール情報を取得して結合 (Drizzleのjoinを使うことも可能)
  const profile = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      avatar: usersTable.avatar
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .get()

  await invalidateCommentListCache(path)
  await invalidateRecentCommentsCache()
  await purgeWorkersCache(event, getCommentMutationWorkersCachePurgeOptions(path))
  await purgeCdnByPrefixes(getCommentMutationPurgePrefixes())

  return {
    ...inserted,
    profiles: profile
  }
})
