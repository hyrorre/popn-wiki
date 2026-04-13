import { db } from '@nuxthub/db'
import { desc, eq } from 'drizzle-orm'
import { pagesTable } from '../db/schema'

type DeletePageRequest = {
  path?: string
}

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody<DeletePageRequest>(event)
  const path = payload.path?.trim()

  if (!path) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const latest = await db
    .select()
    .from(pagesTable)
    .where(eq(pagesTable.path, path))
    .orderBy(desc(pagesTable.revision))
    .get()

  if (!latest || latest.body === '') {
    throw createError({
      statusCode: 404,
      message: 'Page not found or already deleted.'
    })
  }

  const nextRevision = latest.revision + 1
  const now = new Date().toISOString()

  const inserted = await db
    .insert(pagesTable)
    .values({
      path,
      revision: nextRevision,
      body: '',
      message: 'ページ削除',
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()
    .get()

  return inserted
})
