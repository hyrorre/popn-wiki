import { resolvePageTitle } from '../utils/page'
import { readZodBody } from '~/server/utils/validation'
import { parseSafeMarkdown } from '~/server/utils/markdown'
import { assertPageBaseRevision, getLatestPageRevision, insertPageRevision } from '~/server/utils/pageRevision'
import { requireApiUser } from '~/server/utils/authorization'
import { invalidatePageMutationCaches } from '~/server/utils/mutationCache'
import { updatePageSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  const payload = await readZodBody(event, updatePageSchema)
  const { path, body, baseRevision } = payload
  const { sanitizedMarkdown: sanitizedBody, ast } = await parseSafeMarkdown(body)

  const latestRevision = await getLatestPageRevision(path)
  assertPageBaseRevision(baseRevision, latestRevision)

  const nextRevision = latestRevision + 1
  const now = new Date().toISOString()

  const title = resolvePageTitle(sanitizedBody, path)

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

  await invalidatePageMutationCaches(event, path)

  return inserted
})
