import { commentsTable, usersTable } from '../db/schema'
import { eq, desc, asc, aliasedTable, sql, and, isNull, inArray } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import type { H3Event } from 'h3'
import { getCommentListCacheRawKey, getCommentListCacheVersion } from '~/server/utils/commentCache'
import { CDN_CACHE_TTL, setPublicCdnCacheHeaders } from '~/server/utils/cacheHeaders'
import { getCommentListWorkersCacheTags, setWorkersCacheTags } from '~/server/utils/workersCache'

const COMMENT_LIST_MAX_AGE = 60 * 60 * 2

type CommentListQuery = {
  path: string
  page: number
  limit: number
}

const cachedCommentListHandler = defineCachedEventHandler(
  async (event) => {
    return readCommentList(event, getCommentListQuery(event))
  },
  {
    group: 'comments',
    name: 'list',
    maxAge: COMMENT_LIST_MAX_AGE,
    swr: true,
    getKey: async (event) => {
      const query = getCommentListQuery(event)
      const version = await getCommentListCacheVersion(query.path)
      return getCommentListCacheRawKey(query.path, query.page, query.limit, version)
    }
  }
)

export default defineEventHandler(async (event) => {
  event.context.commentListQuery = parseCommentListQuery(event)
  const result = await cachedCommentListHandler(event)
  if (!event.node.res.headersSent) {
    const query = getCommentListQuery(event)
    setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.commentList)
    setWorkersCacheTags(event, getCommentListWorkersCacheTags(query.path))
  }
  return result
})

function getCommentListQuery(event: H3Event): CommentListQuery {
  const query = event.context.commentListQuery as CommentListQuery | undefined

  if (!query) {
    throw createError({ statusCode: 500, message: 'Comment list query is missing.' })
  }

  return query
}

function parseCommentListQuery(event: H3Event): CommentListQuery {
  const query = getQuery(event)
  const path = query.path as string | undefined

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  return {
    path,
    page: parsePositiveInteger(query.page, 1),
    limit: parsePositiveInteger(query.limit, 20)
  }
}

async function readCommentList(event: H3Event, query: CommentListQuery) {
  const offset = (query.page - 1) * query.limit

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(commentsTable)
    .where(and(eq(commentsTable.path, query.path), isNull(commentsTable.replyTo), isNull(commentsTable.deletedAt)))
    .get()
  const total = countResult?.count ?? 0

  if (total === 0) {
    return { comments: [], total: 0 }
  }

  const rootIdsResult = await db
    .select({ id: commentsTable.id })
    .from(commentsTable)
    .where(and(eq(commentsTable.path, query.path), isNull(commentsTable.replyTo), isNull(commentsTable.deletedAt)))
    .orderBy(desc(commentsTable.createdAt))
    .limit(query.limit)
    .offset(offset)
    .all()

  const rootIds = rootIdsResult.map((result) => result.id)

  if (rootIds.length === 0) {
    return { comments: [], total }
  }

  const tree = db.$with('tree').as(
    db
      .select({
        id: commentsTable.id,
        path: commentsTable.path,
        body: commentsTable.body,
        bodyAst: commentsTable.bodyAst,
        replyTo: commentsTable.replyTo,
        userId: commentsTable.userId,
        createdAt: commentsTable.createdAt,
        updatedAt: commentsTable.updatedAt,
        rootCreatedAt: sql<string>`${commentsTable.createdAt}`.as('rootCreatedAt')
      })
      .from(commentsTable)
      .where(and(inArray(commentsTable.id, rootIds), isNull(commentsTable.deletedAt)))
      .unionAll(
        db
          .select({
            id: commentsTable.id,
            path: commentsTable.path,
            body: commentsTable.body,
            bodyAst: commentsTable.bodyAst,
            replyTo: commentsTable.replyTo,
            userId: commentsTable.userId,
            createdAt: commentsTable.createdAt,
            updatedAt: commentsTable.updatedAt,
            rootCreatedAt: sql<string>`tree.rootCreatedAt`.as('rootCreatedAt')
          })
          .from(commentsTable)
          .innerJoin(sql`tree`, eq(commentsTable.replyTo, sql`tree.id`))
          .where(isNull(commentsTable.deletedAt))
      )
  )

  const parentComments = aliasedTable(commentsTable, 'parent_comments')
  const parentProfiles = aliasedTable(usersTable, 'parent_profiles')

  const comments = await db
    .with(tree)
    .select({
      id: tree.id,
      path: tree.path,
      body: tree.body,
      bodyAst: tree.bodyAst,
      createdAt: tree.createdAt,
      updatedAt: tree.updatedAt,
      userId: tree.userId,
      replyTo: tree.replyTo,
      profiles: {
        id: usersTable.id,
        name: usersTable.name
      },
      replyToName: parentProfiles.name
    })
    .from(tree)
    .leftJoin(usersTable, eq(tree.userId, usersTable.id))
    .leftJoin(parentComments, eq(tree.replyTo, parentComments.id))
    .leftJoin(parentProfiles, eq(parentComments.userId, parentProfiles.id))
    .orderBy(desc(sql`tree.rootCreatedAt`), asc(tree.createdAt))
    .all()

  return {
    comments,
    total
  }
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
