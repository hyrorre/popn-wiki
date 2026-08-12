import { removePageSearchIndex } from '../utils/pageSearchIndex'
import { assertPageBaseRevision, getLatestPage, insertPageRevision } from '../utils/pageRevision'
import { requireApiUser } from '../utils/authorization'
import { invalidatePageMutationCaches } from '../utils/mutationCache'
import { parseStrictIntegerQuery } from '../utils/queryInteger'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path.trim() : ''
  const baseRevision = parseStrictIntegerQuery(query.baseRevision, {
    minimum: 1,
    message: 'Invalid payload.'
  })

  if (!path) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const latest = await getLatestPage(path)

  if (!latest || latest.body === '') {
    throw createError({ statusCode: 404, message: 'Page not found or already deleted.' })
  }

  assertPageBaseRevision(baseRevision, latest.revision)

  const nextRevision = latest.revision + 1
  const now = new Date().toISOString()

  const inserted = await insertPageRevision({
    path,
    revision: nextRevision,
    body: '',
    message: 'ページ削除',
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
    updatedBy: user.id
  })

  await removePageSearchIndex(path)
  await invalidatePageMutationCaches(event, path)

  return inserted
})
