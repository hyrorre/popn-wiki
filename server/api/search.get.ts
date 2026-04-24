import { db } from '@nuxthub/db'
import { aliasedTable, and, eq, gt, inArray, isNull, notExists, sql } from 'drizzle-orm'
import { commentsTable, pagesTable } from '../db/schema'
import { searchQuerySchema } from '~/shared/zod'

type SearchMatchType = 'title' | 'path' | 'body' | 'comment'
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
  commentCountMatched: number
  score: number
}

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
  const latestPages = await readLatestVisiblePages(terms)

  if (latestPages.length === 0) {
    return { query: q, page, limit, total: 0, items: [] }
  }

  const latestPagePaths = latestPages.map((entry) => entry.path)
  const comments = await db
    .select({
      path: commentsTable.path,
      body: commentsTable.body
    })
    .from(commentsTable)
    .where(and(isNull(commentsTable.deletedAt), inArray(commentsTable.path, latestPagePaths)))
    .all()

  const commentsByPath = new Map<string, string[]>()
  for (const comment of comments) {
    const bucket = commentsByPath.get(comment.path) ?? []
    bucket.push(comment.body)
    commentsByPath.set(comment.path, bucket)
  }

  const items = latestPages
    .map((entry) => buildSearchResult(entry, commentsByPath.get(entry.path) ?? [], terms))
    .filter((entry): entry is SearchResultItem => entry !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.updatedAt.localeCompare(left.updatedAt)
    })

  const start = (page - 1) * limit

  return {
    query: q,
    page,
    limit,
    total: items.length,
    items: items.slice(start, start + limit)
  }
})

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
    OR EXISTS (
      SELECT 1
      FROM ${commentsTable}
      WHERE ${commentsTable.path} = ${pagesTable.path}
        AND ${commentsTable.deletedAt} IS NULL
        AND lower(${commentsTable.body}) LIKE ${pattern} ESCAPE ${escape}
    )
  )`
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function splitTerms(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeText)
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase('ja-JP')
}

function buildSearchResult(page: LatestPage, comments: string[], terms: string[]): SearchResultItem | null {
  const title = page.title || (page.path === '/' ? 'Home' : page.path.split('/').pop() || page.path)
  const normalizedTitle = normalizeText(title)
  const normalizedPath = normalizeText(page.path)
  const normalizedBody = normalizeText(page.body)
  const matchedComments = comments.filter((comment) => matchesAnyTerm(comment, terms))
  const normalizedMatchedComments = matchedComments.map(normalizeText)

  const allTermsMatched = terms.every((term) => {
    if (normalizedTitle.includes(term) || normalizedPath.includes(term) || normalizedBody.includes(term)) {
      return true
    }

    return normalizedMatchedComments.some((comment) => comment.includes(term))
  })

  if (!allTermsMatched) {
    return null
  }

  const titleMatched = terms.some((term) => normalizedTitle.includes(term))
  const pathMatched = terms.some((term) => normalizedPath.includes(term))
  const bodyMatched = terms.some((term) => normalizedBody.includes(term))
  const commentMatched = matchedComments.length > 0

  const matchTypes = [
    ...(titleMatched ? (['title'] as const) : []),
    ...(pathMatched ? (['path'] as const) : []),
    ...(bodyMatched ? (['body'] as const) : []),
    ...(commentMatched ? (['comment'] as const) : [])
  ]

  const snippetType: SnippetType = titleMatched
    ? 'title'
    : pathMatched
      ? 'path'
      : bodyMatched
        ? 'body'
        : 'comment'

  const snippetSource = snippetType === 'title' ? title : snippetType === 'path' ? page.path : snippetType === 'body' ? page.body : matchedComments[0] || ''

  return {
    path: page.path,
    title,
    revision: page.revision,
    updatedAt: page.updatedAt,
    matchTypes,
    snippet: createSnippet(snippetSource, terms),
    snippetType,
    commentCountMatched: matchedComments.length,
    score: calculateScore({
      title: normalizedTitle,
      path: normalizedPath,
      body: normalizedBody,
      comments: normalizedMatchedComments,
      terms
    })
  }
}

function matchesAnyTerm(text: string, terms: string[]) {
  const normalized = normalizeText(text)
  return terms.some((term) => normalized.includes(term))
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

function calculateScore({
  title,
  path,
  body,
  comments,
  terms
}: {
  title: string
  path: string
  body: string
  comments: string[]
  terms: string[]
}) {
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

    if (comments.some((comment) => comment.includes(term))) {
      score += 8
    }
  }

  return score
}
