import { commentsTable, usersTable } from '../db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { invalidateCommentListCache } from '~/server/utils/commentCache'
import { purgeCdnByUrls } from '~/server/utils/cfCachePurge'
import { readZodBody } from '~/server/utils/validation'
import { sanitizeDangerousMarkdownHtml, mdcParseOptions } from '~/server/utils/markdown'
import { createCommentSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'comment:post', limit: 10 })
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const { path, body, replyTo } = await readZodBody(event, createCommentSchema)
  const sanitizedBody = sanitizeDangerousMarkdownHtml(body).trim()

  if (!sanitizedBody) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
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
  const profile = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).get()

  await invalidateCommentListCache(path)
  await purgeCdnByUrls([`https://popn.wiki/api/comment?path=${encodeURIComponent(path)}&page=1&limit=20`])

  return {
    ...inserted,
    profiles: profile
  }
})
