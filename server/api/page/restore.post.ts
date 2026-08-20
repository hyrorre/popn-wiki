import { pagesTable } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseSafeMarkdown } from '../../utils/markdown'
import { readZodBody } from '~/server/utils/validation'
import { restorePageSchema } from '~/shared/zod'
import { assertPageBaseRevision, getLatestPageRevision, insertPageRevision } from '~/server/utils/pageRevision'
import { requireApiUser } from '~/server/utils/authorization'
import { invalidatePageMutationCaches } from '~/server/utils/mutationCache'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

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

  const { sanitizedMarkdown, ast } = await parseSafeMarkdown(targetPage.body)

  const inserted = await insertPageRevision({
    path,
    title: targetPage.title,
    revision: nextRevision,
    body: sanitizedMarkdown,
    bodyAst: JSON.stringify(ast),
    message: `Restore revision ${targetRevision}`,
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
    updatedBy: user.id
  })

  await invalidatePageMutationCaches(event, path)

  return inserted
})
