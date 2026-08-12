import { db } from '@nuxthub/db'
import { desc, eq } from 'drizzle-orm'
import { pagesTable } from '~/server/db/schema'

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
  const inserted = await db
    .insert(pagesTable)
    .values(values)
    .onConflictDoNothing({ target: [pagesTable.path, pagesTable.revision] })
    .returning()
    .get()

  if (!inserted) {
    throwPageRevisionConflict(await getLatestPageRevision(values.path))
  }

  return inserted
}

function throwPageRevisionConflict(latestRevision: number): never {
  throw createError({
    statusCode: 409,
    statusMessage: 'Revision conflict.',
    data: { latestRevision }
  })
}
