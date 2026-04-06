import { db } from '@nuxthub/db'
import { pagesTable, usersTable } from '../../db/schema'
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
      userName: usersTable.name
    })
    .from(pagesTable)
    .leftJoin(usersTable, eq(pagesTable.updatedBy, usersTable.id))
    .where(eq(pagesTable.path, query.path))
    .orderBy(desc(pagesTable.revision))
    .all()

  return data ?? []
})
