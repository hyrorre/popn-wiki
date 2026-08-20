import { commentsTable, usersTable } from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { readZodBody } from '~/server/utils/validation'
import { parseSafeMarkdown } from '~/server/utils/markdown'
import { createCommentSchema } from '~/shared/zod'
import { requireApiUser } from '~/server/utils/authorization'
import { invalidateCommentMutationCaches } from '~/server/utils/mutationCache'

export default defineEventHandler(async (event) => {
  await checkRateLimit(event, { key: 'comment:post', limit: 10 })
  const user = await requireApiUser(event)

  const { path, body, replyTo } = await readZodBody(event, createCommentSchema)
  const { sanitizedMarkdown, ast } = await parseSafeMarkdown(body)
  const sanitizedBody = sanitizedMarkdown.trim()

  if (!sanitizedBody) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const now = new Date().toISOString()
  const values = {
    path,
    body: sanitizedBody,
    bodyAst: JSON.stringify(ast),
    replyTo,
    userId: user.id,
    createdAt: now,
    updatedAt: now
  }

  const inserted =
    replyTo === null
      ? await db.insert(commentsTable).values(values).returning().get()
      : await insertReplyIfParentIsActive(values, replyTo)

  if (!inserted) {
    throw createError({ statusCode: 400, message: 'Invalid reply target.' })
  }

  // プロフィール情報を取得して結合 (Drizzleのjoinを使うことも可能)
  const profile = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      avatar: usersTable.avatar
    })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .get()

  await invalidateCommentMutationCaches(event, path, 'create')

  return {
    ...inserted,
    profiles: profile
  }
})

async function insertReplyIfParentIsActive(values: typeof commentsTable.$inferInsert, replyTo: number) {
  const rows = await db.all<typeof commentsTable.$inferSelect>(sql`
    INSERT INTO comments (path, body, body_ast, reply_to, user_id, created_at, updated_at, deleted_at)
    SELECT
      ${values.path},
      ${values.body},
      ${values.bodyAst ?? null},
      ${replyTo},
      ${values.userId},
      ${values.createdAt},
      ${values.updatedAt},
      NULL
    WHERE EXISTS (
      SELECT 1
      FROM comments AS parent
      WHERE parent.id = ${replyTo}
        AND parent.path = ${values.path}
        AND parent.deleted_at IS NULL
    )
    RETURNING
      id,
      path,
      body,
      body_ast AS bodyAst,
      reply_to AS replyTo,
      user_id AS userId,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deleted_at AS deletedAt
  `)

  return rows[0]
}
