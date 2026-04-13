import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import { and, desc, eq } from 'drizzle-orm'
import { pagesTable } from '../../db/schema'

type RestorePageRequest = {
  path?: string
  targetRevision?: number
}

export default defineEventHandler(async (event) => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody<RestorePageRequest>(event)
  const path = payload.path?.trim()
  const targetRevision = payload.targetRevision ?? -1

  if (!path || !Number.isInteger(targetRevision) || targetRevision < 1) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const targetPage = await db
    .select()
    .from(pagesTable)
    .where(and(eq(pagesTable.path, path), eq(pagesTable.revision, targetRevision)))
    .get()

  if (!targetPage) {
    throw createError({ statusCode: 404, message: 'Target revision not found.' })
  }

  const latest = await db
    .select({ revision: pagesTable.revision })
    .from(pagesTable)
    .where(eq(pagesTable.path, path))
    .orderBy(desc(pagesTable.revision))
    .limit(1)
    .get()

  const nextRevision = (latest?.revision ?? 0) + 1
  const now = new Date().toISOString()

  // 復元対象のページ本文を再解析（あるいは元データに AST があればそれを使っても良いが
  // スキーマ変更前のデータには AST がないので再解析するのが安全）
  const ast = await parseMarkdown(targetPage.body)

  const inserted = await db
    .insert(pagesTable)
    .values({
      path,
      revision: nextRevision,
      body: targetPage.body,
      bodyAst: JSON.stringify(ast),
      message: `Restore revision ${targetRevision}`,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()
    .get()

  return inserted
})
