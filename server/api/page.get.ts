import { pagesTable } from '../db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '@nuxthub/db'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'

export default defineEventHandler(async (event) => {
  const query = (await getQuery(event)) as { path?: string; revision?: string; includeDeleted?: string }
  if (!query.path) {
    throw createError({ status: 400 })
  }

  const includeDeleted = query.includeDeleted === 'true'

  if (query.revision !== undefined) {
    const requestedRevision = Number.parseInt(query.revision, 10)
    if (!Number.isInteger(requestedRevision) || requestedRevision < 1) {
      throw createError({ statusCode: 400, message: 'Invalid revision.' })
    }

    const data = await db
      .select()
      .from(pagesTable)
      .where(and(eq(pagesTable.path, query.path), eq(pagesTable.revision, requestedRevision)))
      .get()

    if (!data) {
      throw createError({ statusCode: 404, message: 'Page not found.' })
    }

    return data
  }

  const data = await db
    .select()
    .from(pagesTable)
    .where(eq(pagesTable.path, query.path))
    .orderBy(desc(pagesTable.revision))
    .get()

  if (!data) {
    throw createError({ statusCode: 404, message: 'Page not found.' })
  }

  // 最新リビジョンの body が空 = 論理削除済み
  if (!includeDeleted && data.body === '') {
    throw createError({ statusCode: 404, message: 'Page has been deleted.' })
  }

  // bodyAst がない場合はオンザフライ解析して保存
  if (!data.bodyAst && data.body) {
    const ast = await parseMarkdown(data.body)
    data.bodyAst = JSON.stringify(ast)

    // 非同期でDBを更新
    const updateTask = db
      .update(pagesTable)
      .set({ bodyAst: data.bodyAst })
      .where(and(eq(pagesTable.path, data.path), eq(pagesTable.revision, data.revision)))
      .execute()

    if (event.context.waitUntil) {
      event.context.waitUntil(updateTask)
    }
  }

  return data
})
