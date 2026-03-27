import { pagesTable } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { db } from '@nuxthub/db'

type UpdatePageRequest = {
  path?: string
  body?: string
  baseRevision?: number
  message?: string
}

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody<UpdatePageRequest>(event)
  const path = payload.path?.trim()
  const body = payload.body
  const baseRevision = payload.baseRevision ?? -1

  if (!path || typeof body !== 'string' || !Number.isInteger(baseRevision) || baseRevision < 0) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

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

  const inserted = await db
    .insert(pagesTable)
    .values({
      path,
      revision: nextRevision,
      body,
      message: payload.message?.trim() || null,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()
    .get()

  return inserted
})
