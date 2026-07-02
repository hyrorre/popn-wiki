import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export type PageSearchIndexEntry = {
  path: string
  title: string
  body: string
  revision: number
  updatedAt: string
}

export async function replacePageSearchIndex(entry: PageSearchIndexEntry) {
  try {
    const removed = await removePageSearchIndex(entry.path)
    if (!removed) {
      return
    }

    if (!entry.body) {
      return
    }

    await db.run(sql`
      INSERT INTO page_search_fts (path, title, body, revision, updated_at)
      VALUES (${entry.path}, ${entry.title}, ${entry.body}, ${entry.revision}, ${entry.updatedAt})
    `)
  } catch (error) {
    if (isMissingPageSearchIndex(error)) {
      console.warn('[PageSearchIndex] page_search_fts table is missing. Skipped index update.')
      return
    }

    if (isPageSearchIndexError(error)) {
      console.warn(`[PageSearchIndex] Failed to update page_search_fts. Skipped index update: ${getErrorMessage(error)}`)
      return
    }

    throw error
  }
}

export async function removePageSearchIndex(path: string): Promise<boolean> {
  try {
    await db.run(sql`DELETE FROM page_search_fts WHERE path = ${path}`)
    return true
  } catch (error) {
    if (isMissingPageSearchIndex(error)) {
      console.warn('[PageSearchIndex] page_search_fts table is missing. Skipped index removal.')
      return false
    }

    if (isPageSearchIndexError(error)) {
      console.warn(`[PageSearchIndex] Failed to remove from page_search_fts. Skipped index removal: ${getErrorMessage(error)}`)
      return false
    }

    throw error
  }
}

export async function rebuildPageSearchIndex() {
  try {
    await db.run(sql`DELETE FROM page_search_fts`)
    await db.run(sql`
      INSERT INTO page_search_fts (path, title, body, revision, updated_at)
      SELECT pages.path, pages.title, pages.body, pages.revision, pages.updated_at
      FROM pages
      WHERE pages.body != ''
        AND NOT EXISTS (
          SELECT 1
          FROM pages AS newer_revision
          WHERE newer_revision.path = pages.path
            AND newer_revision.revision > pages.revision
        )
    `)

    const result = await db.get<{ count: number }>(sql`SELECT count(*) AS count FROM page_search_fts`)
    return { indexed: result?.count ?? 0 }
  } catch (error) {
    if (isMissingPageSearchIndex(error)) {
      return { indexed: 0, skipped: 'page_search_fts table is missing' }
    }

    if (isPageSearchIndexError(error)) {
      return { indexed: 0, skipped: getErrorMessage(error) }
    }

    throw error
  }
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
