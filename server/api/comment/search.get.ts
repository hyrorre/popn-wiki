import { db } from '@nuxthub/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { commentsTable, usersTable } from '~/server/db/schema'
import { searchQuerySchema } from '~/shared/zod'
import { parseZodQuery } from '~/server/utils/validation'

type CommentSearchItem = {
  id: number
  path: string
  pageTitle: string
  body: string
  snippet: string
  createdAt: string
  updatedAt: string
  userName: string | null
}

export default defineEventHandler(async (event) => {
  const { q, page, limit } = parseZodQuery(event, searchQuerySchema)
  const terms = splitTerms(q)
  const offset = (page - 1) * limit
  const where = buildCommentSearchWhere(terms)

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(commentsTable)
    .where(where)
    .get()

  const total = countResult?.count ?? 0
  if (total === 0) {
    return { query: q, page, limit, total: 0, items: [] as CommentSearchItem[] }
  }

  const rows = await db
    .select({
      id: commentsTable.id,
      path: commentsTable.path,
      pageTitle: sql<string>`(SELECT title FROM pages
        WHERE path = ${commentsTable.path} ORDER BY revision DESC LIMIT 1)`,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
      updatedAt: commentsTable.updatedAt,
      userName: usersTable.name
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(where)
    .orderBy(desc(commentsTable.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  return {
    query: q,
    page,
    limit,
    total,
    items: rows.map((row) => ({
      ...row,
      pageTitle: row.pageTitle || (row.path === '/' ? 'Home' : row.path.split('/').pop() || row.path),
      snippet: createSnippet(row.body, terms)
    }))
  }
})

function buildCommentSearchWhere(terms: string[]) {
  return and(
    isNull(commentsTable.deletedAt),
    // Resolve one latest revision per comment instead of joining every historical revision.
    sql`(SELECT body != '' FROM pages
      WHERE path = ${commentsTable.path} ORDER BY revision DESC LIMIT 1)`,
    ...terms.map(buildTermCommentCondition)
  )
}

function buildTermCommentCondition(term: string) {
  const pattern = `%${escapeLikePattern(term)}%`
  const escape = '\\'

  return sql`lower(${commentsTable.body}) LIKE ${pattern} ESCAPE ${escape}`
}

function splitTerms(query: string) {
  return query.trim().split(/\s+/).filter(Boolean).map(normalizeText)
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase('ja-JP')
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
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
