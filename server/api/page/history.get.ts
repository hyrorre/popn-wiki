import { db } from '@nuxthub/db'
import { pagesTable, usersTable } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { parseZodValue } from '~/server/utils/validation'
import { parseStrictIntegerQuery } from '~/server/utils/queryInteger'
import { wikiPathSchema } from '~/shared/zod'

const DEFAULT_HISTORY_LIMIT = 50
const MAX_HISTORY_LIMIT = 100
const MAX_HISTORY_OFFSET = 1_000_000

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = parseZodValue(query.path, wikiPathSchema, { message: 'Path is required.' })
  const limit = parseStrictIntegerQuery(query.limit, {
    fallback: DEFAULT_HISTORY_LIMIT,
    minimum: 1,
    maximum: MAX_HISTORY_LIMIT
  })
  const offset = parseStrictIntegerQuery(query.offset, {
    fallback: 0,
    minimum: 0,
    maximum: MAX_HISTORY_OFFSET
  })
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
    .limit(limit)
    .offset(offset)
    .all()

  return data ?? []
})
