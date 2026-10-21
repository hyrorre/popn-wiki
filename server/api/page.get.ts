import { pagesTable } from '../db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { isMarkdownAstOutdated, parseSafeMarkdown } from '~/server/utils/markdown'
import type { H3Event } from 'h3'
import {
  getLatestPageCacheKey,
  getLatestPageCacheVersion,
  getRevisionPageCacheKey
} from '~/server/utils/pageCache'
import { CDN_CACHE_TTL, setNoStoreCacheHeaders, setPublicCdnCacheHeaders } from '~/server/utils/cacheHeaders'
import { getPageResponseWorkersCacheTags, setWorkersCacheTags } from '~/server/utils/workersCache'
import { parseStrictIntegerQuery } from '~/server/utils/queryInteger'
import { parseZodValue } from '~/server/utils/validation'
import { wikiPathSchema } from '~/shared/zod'

const LATEST_PAGE_TTL = CDN_CACHE_TTL.pageLatest
const REVISION_PAGE_TTL = CDN_CACHE_TTL.pageRevision

type PageQuery = {
  path: string
  revision?: number
  fresh: boolean
}

type CachedPage = typeof pagesTable.$inferSelect

export default defineEventHandler(async (event) => {
  const query = parsePageQuery(event)

  if (query.revision !== undefined) {
    const data = await withRevisionCache(event, query)
    setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.pageRevision, { immutable: true })
    setWorkersCacheTags(event, getPageResponseWorkersCacheTags(query.path, query.revision))
    return data
  }

  if (query.fresh) {
    setNoStoreCacheHeaders(event)
    return readLatestPage(event, query)
  }

  const data = await withLatestCache(event, query)
  setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.pageLatest)
  setWorkersCacheTags(event, getPageResponseWorkersCacheTags(query.path))
  return data
})

async function withLatestCache(event: H3Event, query: PageQuery) {
  const version = await getLatestPageCacheVersion(query.path)
  const key = getLatestPageCacheKey(query.path, version)
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
  const query = getQuery(event)
  const path = parseZodValue(query.path, wikiPathSchema, { message: 'Path is required.' })

  const base = { path, fresh: query.fresh === '1' || query.fresh === 'true' }

  if (query.revision === undefined) {
    return base
  }

  const revision = parseStrictIntegerQuery(query.revision, {
    minimum: 1,
    message: 'Invalid revision.'
  })

  return { ...base, revision }
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
  if (data.body && isMarkdownAstOutdated(data.bodyAst)) {
    const { sanitizedMarkdown, ast } = await parseSafeMarkdown(data.body)
    data.body = sanitizedMarkdown
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
