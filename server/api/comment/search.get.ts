import { db } from '@nuxthub/db'
import { aliasedTable, and, desc, eq, gt, isNull, notExists, sql } from 'drizzle-orm'
import { commentsTable, pagesTable, usersTable } from '~/server/db/schema'
import { searchQuerySchema } from '~/shared/zod'

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
  const offset = (page - 1) * limit
  const where = buildCommentSearchWhere(terms)

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(commentsTable)
    .innerJoin(pagesTable, eq(commentsTable.path, pagesTable.path))
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
      pageTitle: pagesTable.title,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
      updatedAt: commentsTable.updatedAt,
      userName: usersTable.name
    })
    .from(commentsTable)
    .innerJoin(pagesTable, eq(commentsTable.path, pagesTable.path))
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
  const newerRevision = aliasedTable(pagesTable, 'newer_revision')

  return and(
    isNull(commentsTable.deletedAt),
    sql`${pagesTable.body} != ''`,
    notExists(
      db
        .select({ one: sql`1` })
        .from(newerRevision)
        .where(and(eq(newerRevision.path, pagesTable.path), gt(newerRevision.revision, pagesTable.revision)))
    ),
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
