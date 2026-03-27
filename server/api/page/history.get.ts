import { db } from '@nuxthub/db'
import { pagesTable } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = (await getQuery(event)) as { path?: string }
  if (!query.path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }
  const data = await db
    .select()
    .from(pagesTable)
    .where(eq(pagesTable.path, query.path))
    .orderBy(desc(pagesTable.revision))
    .all()

  return data ?? []
})
