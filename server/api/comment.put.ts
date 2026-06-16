import { commentsTable, usersTable } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { invalidateCommentListCache } from '~/server/utils/commentCache'
import { getCommentMutationPurgeUrls, purgeCdnByUrls } from '~/server/utils/cfCachePurge'
import { readZodBody } from '~/server/utils/validation'
import { sanitizeDangerousMarkdownHtml, mdcParseOptions } from '~/server/utils/markdown'
import { updateCommentSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'comment:put', limit: 10 })
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const { id, body } = await readZodBody(event, updateCommentSchema)
  const sanitizedBody = sanitizeDangerousMarkdownHtml(body).trim()

  if (!sanitizedBody) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const now = new Date().toISOString()
  const ast = await parseMarkdown(sanitizedBody, mdcParseOptions)

  const updated = await db
    .update(commentsTable)
    .set({
      body: sanitizedBody,
      bodyAst: JSON.stringify(ast),
      updatedAt: now
    })
    .where(and(eq(commentsTable.id, id), eq(commentsTable.userId, user.id)))
    .returning()
    .get()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  const profile = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).get()

  await invalidateCommentListCache(updated.path)
  await purgeCdnByUrls(getCommentMutationPurgeUrls(updated.path))

  return {
    ...updated,
    profiles: profile
  }
})
