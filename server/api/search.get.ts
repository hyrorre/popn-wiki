import { db } from '@nuxthub/db'
import { aliasedTable, and, eq, gt, notExists, sql } from 'drizzle-orm'
import { pagesTable } from '../db/schema'
import { isMissingPageSearchIndex, isPageSearchIndexError } from '../utils/pageSearchIndex'
import { searchQuerySchema } from '~/shared/zod'

type SearchMatchType = 'title' | 'path' | 'body'
type SnippetType = SearchMatchType

type LatestPage = {
  path: string
  title: string
  revision: number
  body: string
  updatedAt: string
}

type SearchResultItem = {
  path: string
  title: string
  revision: number
  updatedAt: string
  matchTypes: SearchMatchType[]
  snippet: string
  snippetType: SnippetType
  score: number
}

type SearchResult = {
  total: number
  items: SearchResultItem[]
}

type FtsPageSearchRow = LatestPage & {
  rank: number
}

const MIN_FTS_TERM_LENGTH = 3

export default defineEventHandler(async (event) => {
  const parsed = searchQuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid query.',
      data: parsed.error.flatten()
    })
  }

  const { q, page, limit } = parsed.data
  const terms = splitTerms(q)
  const result = await readSearchResult(terms, page, limit)

  return {
    query: q,
    page,
    limit,
    total: result.total,
    items: result.items
  }
})

async function readSearchResult(terms: string[], page: number, limit: number): Promise<SearchResult> {
  if (canUsePageFts(terms)) {
    try {
      return await readPageFtsSearchResult(terms, page, limit)
    } catch (error) {
      if (!isPageSearchIndexError(error)) {
        throw error
      }

      if (isMissingPageSearchIndex(error)) {
        console.warn('[Search] page_search_fts table is missing. Falling back to legacy page search.')
      } else {
        console.warn('[Search] page_search_fts query failed. Falling back to legacy page search.')
      }
    }
  }

  return readLegacySearchResult(terms, page, limit)
}

async function readPageFtsSearchResult(terms: string[], page: number, limit: number): Promise<SearchResult> {
  const ftsQuery = buildFtsQuery(terms)
  const offset = (page - 1) * limit
  const countResult = await db.get<{ total: number }>(sql`
    SELECT count(*) AS total
    FROM page_search_fts
    WHERE page_search_fts MATCH ${ftsQuery}
  `)
  const total = Number(countResult?.total ?? 0)

  if (total === 0) {
    return { total: 0, items: [] }
  }

  const rows = await db.all<FtsPageSearchRow>(sql`
    SELECT
      path,
      title,
      CAST(revision AS INTEGER) AS revision,
      body,
      updated_at AS updatedAt,
      bm25(page_search_fts, 6.0, 8.0, 1.0, 0.0, 0.0) AS rank
    FROM page_search_fts
    WHERE page_search_fts MATCH ${ftsQuery}
    ORDER BY rank, updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  return {
    total,
    items: rows
      .map((entry) => buildSearchResult(entry, terms, false))
      .filter((entry): entry is SearchResultItem => entry !== null)
  }
}

async function readLegacySearchResult(terms: string[], page: number, limit: number): Promise<SearchResult> {
  const latestPages = await readLatestVisiblePages(terms)

  if (latestPages.length === 0) {
    return { total: 0, items: [] }
  }

  const items = latestPages
    .map((entry) => buildSearchResult(entry, terms))
    .filter((entry): entry is SearchResultItem => entry !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.updatedAt.localeCompare(left.updatedAt)
    })

  const start = (page - 1) * limit

  return {
    total: items.length,
    items: items.slice(start, start + limit)
  }
}

async function readLatestVisiblePages(terms: string[]) {
  const newerRevision = aliasedTable(pagesTable, 'newer_revision')

  return db
    .select({
      path: pagesTable.path,
      title: pagesTable.title,
      revision: pagesTable.revision,
      body: pagesTable.body,
      updatedAt: pagesTable.updatedAt
    })
    .from(pagesTable)
    .where(
      and(
        sql`${pagesTable.body} != ''`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(newerRevision)
            .where(and(eq(newerRevision.path, pagesTable.path), gt(newerRevision.revision, pagesTable.revision)))
        ),
        ...terms.map(buildTermCandidateCondition)
      )
    )
    .all()
}

function buildTermCandidateCondition(term: string) {
  const pattern = `%${escapeLikePattern(term)}%`
  const escape = '\\'

  return sql`(
    lower(${pagesTable.title}) LIKE ${pattern} ESCAPE ${escape}
    OR lower(${pagesTable.path}) LIKE ${pattern} ESCAPE ${escape}
    OR lower(${pagesTable.body}) LIKE ${pattern} ESCAPE ${escape}
  )`
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function splitTerms(query: string) {
  return query.trim().split(/\s+/).filter(Boolean).map(normalizeText)
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase('ja-JP')
}

function buildSearchResult(page: LatestPage, terms: string[], requireExactMatch = true): SearchResultItem | null {
  const title = page.title || (page.path === '/' ? 'Home' : page.path.split('/').pop() || page.path)
  const normalizedTitle = normalizeText(title)
  const normalizedPath = normalizeText(page.path)
  const normalizedBody = normalizeText(page.body)

  const allTermsMatched = terms.every((term) => {
    return normalizedTitle.includes(term) || normalizedPath.includes(term) || normalizedBody.includes(term)
  })

  if (requireExactMatch && !allTermsMatched) {
    return null
  }

  const titleMatched = terms.some((term) => normalizedTitle.includes(term))
  const pathMatched = terms.some((term) => normalizedPath.includes(term))
  const bodyMatched = terms.some((term) => normalizedBody.includes(term))

  const matchTypes = [
    ...(titleMatched ? (['title'] as const) : []),
    ...(pathMatched ? (['path'] as const) : []),
    ...(bodyMatched ? (['body'] as const) : [])
  ]
  const resolvedMatchTypes: SearchMatchType[] = matchTypes.length > 0 ? matchTypes : ['body']

  const snippetType: SnippetType = titleMatched ? 'title' : pathMatched ? 'path' : 'body'

  const snippetSource = snippetType === 'title' ? title : snippetType === 'path' ? page.path : page.body

  return {
    path: page.path,
    title,
    revision: page.revision,
    updatedAt: page.updatedAt,
    matchTypes: resolvedMatchTypes,
    snippet: createSnippet(snippetSource, terms),
    snippetType,
    score: calculateScore({
      title: normalizedTitle,
      path: normalizedPath,
      body: normalizedBody,
      terms
    })
  }
}

function createSnippet(source: string, terms: string[]) {
  const text = source.replace(/\s+/g, ' ').trim()

  if (!text) {
    return ''
  }

  const normalized = normalizeText(text)
  const firstIndex = terms.reduce((best, term) => {
    const index = normalized.indexOf(term)
    if (index === -1) {
      return best
    }

    return best === -1 ? index : Math.min(best, index)
  }, -1)

  if (firstIndex === -1 || text.length <= 140) {
    return text.slice(0, 140)
  }

  const start = Math.max(0, firstIndex - 50)
  const end = Math.min(text.length, firstIndex + 90)

  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

function calculateScore({ title, path, body, terms }: { title: string; path: string; body: string; terms: string[] }) {
  let score = 0

  for (const term of terms) {
    if (title.includes(term)) {
      score += 40
      if (title.startsWith(term)) {
        score += 10
      }
    }

    if (path.includes(term)) {
      score += 30
      if (path.startsWith(term) || path.includes(`/${term}`)) {
        score += 10
      }
    }

    if (body.includes(term)) {
      score += 10
    }
  }

  return score
}

function canUsePageFts(terms: string[]) {
  return terms.every((term) => Array.from(term).length >= MIN_FTS_TERM_LENGTH)
}

function buildFtsQuery(terms: string[]) {
  return terms.map(quoteFtsPhrase).join(' AND ')
}

function quoteFtsPhrase(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}
