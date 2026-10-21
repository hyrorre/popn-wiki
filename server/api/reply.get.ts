import { commentsTable, usersTable } from '../db/schema'
import { eq, desc, sql, inArray } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseStrictIntegerQuery } from '~/server/utils/queryInteger'
import { requireApiUser } from '~/server/utils/authorization'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)
  const userId = user.id
  const query = getQuery(event)
  const type = query.type ?? 'direct'

  if (typeof type !== 'string' || (type !== 'direct' && type !== 'thread')) {
    throw createError({ statusCode: 400, message: 'Invalid reply type.' })
  }

  const limit = parseStrictIntegerQuery(query.limit, { fallback: 20, minimum: 1, maximum: 100 })
  const offset = parseStrictIntegerQuery(query.offset, { fallback: 0, minimum: 0, maximum: 1_000_000 })

  let replyIds: number[]

  if (type === 'direct') {
    // 1. 自分への直接返信
    // CROSS JOIN keeps the indexed user lookup before the reply lookup.
    const results = await db.all<{ id: number }>(sql`
      SELECT reply.id
      FROM comments AS mine CROSS JOIN comments AS reply
      WHERE mine.user_id = ${userId}
        AND reply.reply_to = mine.id
        AND reply.user_id != ${userId}
        AND reply.deleted_at IS NULL
      ORDER BY reply.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `)
    replyIds = results.map((r) => r.id)
  } else {
    replyIds = await readThreadReplyIds(userId, limit, offset)
  }

  if (replyIds.length === 0) {
    return []
  }

  const replies = await db
    .select({
      id: commentsTable.id,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
      path: commentsTable.path,
      pageTitle: sql<string | null>`(SELECT title FROM pages
        WHERE path = ${commentsTable.path} ORDER BY revision DESC LIMIT 1)`,
      userName: usersTable.name
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(inArray(commentsTable.id, replyIds))
    .orderBy(desc(commentsTable.createdAt))
    .all()

  // 本文をプレビュー用に加工（簡易的な短縮）
  return replies.map((r) => ({
    ...r,
    bodyPreview: r.body.length > 100 ? `${r.body.substring(0, 100)}...` : r.body
  }))
})

const MAX_PARTICIPATION_SEEDS = 1_000
const MAX_PARTICIPATED_ROOTS = 500
const MAX_REPLY_TREE_DEPTH = 100
const MAX_REPLY_TREE_NODES = 10_000

async function readThreadReplyIds(userId: number, limit: number, offset: number) {
  const results = await db.all<{ id: number }>(sql`
    WITH RECURSIVE
    recent_participation AS (
      SELECT id, reply_to
      FROM comments
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${MAX_PARTICIPATION_SEEDS}
    ),
    ancestry(id, reply_to) AS (
      SELECT id, reply_to
      FROM recent_participation
      UNION
      SELECT parent.id, parent.reply_to
      FROM comments AS parent
      INNER JOIN ancestry ON ancestry.reply_to = parent.id
      LIMIT ${MAX_REPLY_TREE_NODES}
    ),
    my_roots AS (
      SELECT DISTINCT id AS root_id
      FROM ancestry
      WHERE reply_to IS NULL
      LIMIT ${MAX_PARTICIPATED_ROOTS}
    ),
    hierarchy(id, root_id, user_id, created_at, depth) AS (
      SELECT comments.id, comments.id, comments.user_id, comments.created_at, 0
      FROM comments
      INNER JOIN my_roots ON comments.id = my_roots.root_id
      UNION ALL
      SELECT child.id, hierarchy.root_id, child.user_id, child.created_at, hierarchy.depth + 1
      FROM comments AS child
      INNER JOIN hierarchy ON child.reply_to = hierarchy.id
      WHERE hierarchy.depth < ${MAX_REPLY_TREE_DEPTH}
      LIMIT ${MAX_REPLY_TREE_NODES}
    )
    SELECT hierarchy.id
    FROM hierarchy CROSS JOIN comments
    WHERE comments.id = hierarchy.id AND hierarchy.user_id != ${userId}
      AND comments.deleted_at IS NULL
    ORDER BY comments.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  return results.map((result) => Number(result.id))
}
