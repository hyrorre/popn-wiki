import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'
import { parseRebuildPageSearchPayload } from './adminTaskPayload'

export type PageSearchIndexEntry = {
  path: string
  title: string
  body: string
  revision: number
  updatedAt: string
}

export type RebuildPageSearchIndexOptions = {
  reset?: boolean
  limit?: number
  cursor?: string
}

export type RebuildPageSearchIndexResult = {
  scanned: number
  indexed: number
  done: boolean
  reset: boolean
  nextCursor?: string
  skipped?: string
}

export async function rebuildPageSearchIndex(
  options: RebuildPageSearchIndexOptions = {}
): Promise<RebuildPageSearchIndexResult> {
  const { limit, cursor, reset } = parseRebuildPageSearchPayload(options)

  try {
    if (reset) {
      await recreatePageSearchIndex()
    }

    const entries = await readLatestPageSearchIndexEntries({ limit: limit + 1, cursor })
    const batch = entries.slice(0, limit)

    for (const entry of batch) {
      await db.run(sql`DELETE FROM page_search_fts WHERE path = ${entry.path}`)
      await insertPageSearchIndexEntry(entry)
    }

    const done = entries.length <= limit
    const nextCursor = done ? undefined : batch.at(-1)?.path

    return {
      scanned: batch.length,
      indexed: batch.length,
      done,
      reset,
      ...(nextCursor ? { nextCursor } : {})
    }
  } catch (error) {
    if (isMissingPageSearchIndex(error)) {
      return { scanned: 0, indexed: 0, done: false, reset, skipped: 'page_search_fts table is missing' }
    }

    if (isPageSearchIndexError(error)) {
      return { scanned: 0, indexed: 0, done: false, reset, skipped: getErrorMessage(error) }
    }

    throw error
  }
}

async function insertPageSearchIndexEntry(entry: PageSearchIndexEntry) {
  await db.run(sql`
    INSERT INTO page_search_fts (path, title, body, revision, updated_at)
    VALUES (${entry.path}, ${entry.title}, ${entry.body}, ${entry.revision}, ${entry.updatedAt})
  `)
}

async function readLatestPageSearchIndexEntries({ limit, cursor }: { limit: number; cursor?: string }) {
  if (cursor) {
    return db.all<PageSearchIndexEntry>(sql`
      SELECT pages.path, pages.title, pages.body, pages.revision, pages.updated_at AS updatedAt
      FROM pages
      WHERE pages.body != ''
        AND pages.path > ${cursor}
        AND NOT EXISTS (
          SELECT 1
          FROM pages AS newer_revision
          WHERE newer_revision.path = pages.path
            AND newer_revision.revision > pages.revision
        )
      ORDER BY pages.path
      LIMIT ${limit}
    `)
  }

  return db.all<PageSearchIndexEntry>(sql`
    SELECT pages.path, pages.title, pages.body, pages.revision, pages.updated_at AS updatedAt
    FROM pages
    WHERE pages.body != ''
      AND NOT EXISTS (
        SELECT 1
        FROM pages AS newer_revision
        WHERE newer_revision.path = pages.path
          AND newer_revision.revision > pages.revision
      )
    ORDER BY pages.path
    LIMIT ${limit}
  `)
}

async function recreatePageSearchIndex() {
  await db.run(sql`DROP TABLE IF EXISTS page_search_fts`)
  await db.run(sql`
    CREATE VIRTUAL TABLE page_search_fts USING fts5(
      path,
      title,
      body,
      revision UNINDEXED,
      updated_at UNINDEXED,
      tokenize = 'trigram'
    )
  `)
}

export function isMissingPageSearchIndex(error: unknown) {
  const message = getErrorMessage(error)
  return message.includes('page_search_fts') && message.includes('no such table')
}

export function isPageSearchIndexError(error: unknown) {
  return getErrorMessage(error).includes('page_search_fts')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
