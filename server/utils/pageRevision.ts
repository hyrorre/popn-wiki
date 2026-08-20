import { db } from '@nuxthub/db'
import { desc, eq } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { pagesTable } from '~/server/db/schema'

// FTS5 の仮想テーブルは Drizzle schema/migration の管理対象にせず、
// revision と同一 batch で更新するための query builder としてだけ定義する。
const pageSearchFtsTable = sqliteTable('page_search_fts', {
  path: text().notNull(),
  title: text().notNull(),
  body: text().notNull(),
  revision: integer().notNull(),
  updatedAt: text().notNull()
})

export async function getLatestPage(path: string) {
  return db.select().from(pagesTable).where(eq(pagesTable.path, path)).orderBy(desc(pagesTable.revision)).get()
}

export async function getLatestPageRevision(path: string) {
  const latest = await db
    .select({ revision: pagesTable.revision })
    .from(pagesTable)
    .where(eq(pagesTable.path, path))
    .orderBy(desc(pagesTable.revision))
    .get()

  return latest?.revision ?? 0
}

export function assertPageBaseRevision(baseRevision: number, latestRevision: number) {
  if (baseRevision !== latestRevision) {
    throwPageRevisionConflict(latestRevision)
  }
}

export async function insertPageRevision(values: typeof pagesTable.$inferInsert) {
  const insertRevision = db.insert(pagesTable).values(values).returning()
  const removeOldIndex = db.delete(pageSearchFtsTable).where(eq(pageSearchFtsTable.path, values.path))

  try {
    const [insertedRows] = values.body
      ? await db.batch([
          insertRevision,
          removeOldIndex,
          db.insert(pageSearchFtsTable).values({
            path: values.path,
            title: values.title ?? '',
            body: values.body,
            revision: values.revision,
            updatedAt: values.updatedAt
          })
        ])
      : await db.batch([insertRevision, removeOldIndex])

    const inserted = insertedRows[0]
    if (!inserted) {
      throwPageRevisionConflict(await getLatestPageRevision(values.path))
    }

    return inserted
  } catch (error) {
    if (isPageRevisionConflictError(error)) {
      throwPageRevisionConflict(await getLatestPageRevision(values.path))
    }

    throw error
  }
}

function isPageRevisionConflictError(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error)
  return /(?:unique|primary key).*pages\.path.*pages\.revision/i.test(message)
}

function throwPageRevisionConflict(latestRevision: number): never {
  throw createError({
    statusCode: 409,
    statusMessage: 'Revision conflict.',
    data: { latestRevision }
  })
}
