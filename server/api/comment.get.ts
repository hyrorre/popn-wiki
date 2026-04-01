import { commentsTable, profilesTable } from '../db/schema'
import { eq, asc, aliasedTable } from 'drizzle-orm'
import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path as string

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  // 親コメントのプロフィール名を取得するためのエイリアス
  const parentComments = aliasedTable(commentsTable, 'parent_comments')
  const parentProfiles = aliasedTable(profilesTable, 'parent_profiles')

  // Join を使用してプロフィール名と返信先名を取得
  const data = await db
    .select({
      id: commentsTable.id,
      path: commentsTable.path,
      body: commentsTable.body,
      createdAt: commentsTable.createdAt,
      updatedAt: commentsTable.updatedAt,
      userId: commentsTable.userId,
      replyTo: commentsTable.replyTo,
      profiles: {
        id: profilesTable.id,
        name: profilesTable.name
      },
      replyToName: parentProfiles.name
    })
    .from(commentsTable)
    .leftJoin(profilesTable, eq(commentsTable.userId, profilesTable.id))
    .leftJoin(parentComments, eq(commentsTable.replyTo, parentComments.id))
    .leftJoin(parentProfiles, eq(parentComments.userId, parentProfiles.id))
    .where(eq(commentsTable.path, path))
    .orderBy(asc(commentsTable.createdAt))
    .all()

  return data
})
