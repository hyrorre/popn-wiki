import { db } from '@nuxthub/db'
import { pagesTable, usersTable } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { parseZodValue } from '~/server/utils/validation'
import { wikiPathSchema } from '~/shared/zod'

export default defineEventHandler(async (event) => {
  const path = parseZodValue(getQuery(event).path, wikiPathSchema, { message: 'Path is required.' })
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
    .where(eq(pagesTable.path, path))
    .orderBy(desc(pagesTable.revision))
    .all()

  return data ?? []
})
