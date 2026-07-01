import { pagesTable } from '../db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { mdcParseOptions } from '~/server/utils/markdown'
import type { H3Event } from 'h3'
import { getLatestPageCacheKey, getRevisionPageCacheKey } from '~/server/utils/pageCache'
import { CDN_CACHE_TTL, setPublicCdnCacheHeaders } from '~/server/utils/cacheHeaders'

const LATEST_PAGE_TTL = CDN_CACHE_TTL.pageLatest
const REVISION_PAGE_TTL = CDN_CACHE_TTL.pageRevision

type PageQuery = {
  path: string
  revision?: number
}

type CachedPage = typeof pagesTable.$inferSelect

export default defineEventHandler(async (event) => {
  const query = parsePageQuery(event)

  if (query.revision !== undefined) {
    setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.pageRevision)
    return withRevisionCache(event, query)
  }

  setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.pageLatest)
  return withLatestCache(event, query)
})

async function withLatestCache(event: H3Event, query: PageQuery) {
  const key = getLatestPageCacheKey(query.path)
  const cached = await useStorage('cache').getItem<CachedPage>(key)
  if (cached) return cached

  const data = await readLatestPage(event, query)
  event.waitUntil(useStorage('cache').setItem(key, data, { ttl: LATEST_PAGE_TTL }))
  return data
}

async function withRevisionCache(event: H3Event, query: PageQuery) {
  const key = getRevisionPageCacheKey(query.path, query.revision!)
  const cached = await useStorage('cache').getItem<CachedPage>(key)
  if (cached) return cached

  const data = await readRevisionPage(event, query)
  event.waitUntil(useStorage('cache').setItem(key, data, { ttl: REVISION_PAGE_TTL }))
  return data
}

function parsePageQuery(event: H3Event): PageQuery {
  const query = getQuery(event) as { path?: string; revision?: string }

  if (!query.path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  if (query.revision === undefined) {
    return { path: query.path }
  }

  const revision = Number.parseInt(query.revision, 10)
  if (!Number.isInteger(revision) || revision < 1) {
    throw createError({ statusCode: 400, message: 'Invalid revision.' })
  }

  return { path: query.path, revision }
}

async function readRevisionPage(event: H3Event, query: PageQuery) {
  const data = await db
    .select()
    .from(pagesTable)
    .where(and(eq(pagesTable.path, query.path), eq(pagesTable.revision, query.revision!)))
    .get()

  if (!data) {
    throw createError({ statusCode: 404, message: 'Page not found.' })
  }

  return ensureBodyAst(event, data)
}

async function readLatestPage(event: H3Event, query: PageQuery) {
  const data = await db
    .select()
    .from(pagesTable)
    .where(eq(pagesTable.path, query.path))
    .orderBy(desc(pagesTable.revision))
    .get()

  if (!data) {
    throw createError({ statusCode: 404, message: 'Page not found.' })
  }

  return ensureBodyAst(event, data)
}

async function ensureBodyAst(event: H3Event, data: typeof pagesTable.$inferSelect) {
  if (!data.bodyAst && data.body) {
    const ast = await parseMarkdown(data.body, mdcParseOptions)
    data.bodyAst = JSON.stringify(ast)

    const updateTask = db
      .update(pagesTable)
      .set({ bodyAst: data.bodyAst })
      .where(and(eq(pagesTable.path, data.path), eq(pagesTable.revision, data.revision)))
      .execute()

    event.waitUntil(updateTask)
  }

  return data
}
