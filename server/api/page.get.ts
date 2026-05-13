import { pagesTable } from '../db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { mdcParseOptions } from '~/server/utils/markdown'
import type { H3Event } from 'h3'
import { getLatestPageCacheRawKey, getRevisionPageCacheRawKey } from '~/server/utils/pageCache'

const CACHE_CONTROL_NO_STORE = 'private, no-store, max-age=0'
const LATEST_PAGE_MAX_AGE = 60 * 60 * 24
const REVISION_PAGE_MAX_AGE = 60 * 60 * 24 * 30

type PageQuery = {
  path: string
  includeDeleted: boolean
  revision?: number
}

type PageRequestContext = PageQuery & {
  bypassCache: boolean
}

const cachedLatestPageHandler = defineCachedEventHandler(
  async (event) => {
    return readLatestPage(event, getPageRequestContext(event))
  },
  {
    group: 'pages',
    name: 'latest',
    maxAge: LATEST_PAGE_MAX_AGE,
    swr: true,
    getKey: (event) => getLatestPageCacheRawKey(getPageRequestContext(event).path)
  }
)

const cachedRevisionPageHandler = defineCachedEventHandler(
  async (event) => {
    return readRevisionPage(event, getPageRequestContext(event))
  },
  {
    group: 'pages',
    name: 'revision',
    maxAge: REVISION_PAGE_MAX_AGE,
    swr: true,
    getKey: (event) => {
      const query = getPageRequestContext(event)
      return getRevisionPageCacheRawKey(query.path, query.revision!)
    }
  }
)

export default defineEventHandler(async (event) => {
  const query = await resolvePageRequestContext(event)

  if (query.bypassCache) {
    setResponseHeader(event, 'Cache-Control', CACHE_CONTROL_NO_STORE)
    setResponseHeader(event, 'CDN-Cache-Control', CACHE_CONTROL_NO_STORE)
    return query.revision !== undefined ? readRevisionPage(event, query) : readLatestPage(event, query)
  }

  if (query.revision !== undefined) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    setResponseHeader(event, 'CDN-Cache-Control', 'public, max-age=2592000')
    return cachedRevisionPageHandler(event)
  }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'CDN-Cache-Control', 'public, max-age=86400')
  return cachedLatestPageHandler(event)
})

async function resolvePageRequestContext(event: H3Event): Promise<PageRequestContext> {
  const query = parsePageQuery(event)
  const { user } = await getUserSession(event)

  const context: PageRequestContext = {
    ...query,
    bypassCache: !!user || query.includeDeleted
  }

  event.context.pageRequest = context

  return context
}

function getPageRequestContext(event: H3Event): PageRequestContext {
  const context = event.context.pageRequest as PageRequestContext | undefined

  if (!context) {
    throw createError({ statusCode: 500, message: 'Page request context is missing.' })
  }

  return context
}

function parsePageQuery(event: H3Event): PageQuery {
  const query = getQuery(event) as { path?: string; revision?: string; includeDeleted?: string }

  if (!query.path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  if (query.revision === undefined) {
    return {
      path: query.path,
      includeDeleted: query.includeDeleted === 'true'
    }
  }

  const revision = Number.parseInt(query.revision, 10)
  if (!Number.isInteger(revision) || revision < 1) {
    throw createError({ statusCode: 400, message: 'Invalid revision.' })
  }

  return {
    path: query.path,
    includeDeleted: query.includeDeleted === 'true',
    revision
  }
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

  if (!query.includeDeleted && data.body === '') {
    throw createError({ statusCode: 404, message: 'Page has been deleted.' })
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
