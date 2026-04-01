import { db } from '@nuxthub/db'
import { pagesTable, profilesTable } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = (await getQuery(event)) as { path?: string }
  if (!query.path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }
  const data = await db
    .select({
      path: pagesTable.path,
      revision: pagesTable.revision,
      body: pagesTable.body,
      message: pagesTable.message,
      updatedAt: pagesTable.updatedAt,
      updatedBy: pagesTable.updatedBy,
      userName: profilesTable.name
    })
    .from(pagesTable)
    .leftJoin(profilesTable, eq(pagesTable.updatedBy, profilesTable.id))
    .where(eq(pagesTable.path, query.path))
    .orderBy(desc(pagesTable.revision))
    .all()

  return data ?? []
})
