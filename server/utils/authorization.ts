import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { User } from '#auth-utils'
import { usersTable } from '~/server/db/schema'

export function toSessionUser(user: typeof usersTable.$inferSelect): User {
  return {
    id: user.id,
    authVersion: user.authVersion,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    // 想定外の値が DB に入っても管理者権限を付与しない。
    role: user.role === 'admin' ? 'admin' : 'user'
  }
}

function isSameSessionUser(sessionUser: User, currentUser: User) {
  return (
    sessionUser.id === currentUser.id &&
    sessionUser.authVersion === currentUser.authVersion &&
    sessionUser.name === currentUser.name &&
    sessionUser.email === currentUser.email &&
    sessionUser.avatar === currentUser.avatar &&
    sessionUser.role === currentUser.role
  )
}

export async function findActiveApiUser(userId: number, authVersion = 0) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).get()
  if (!user || user.confirmed !== 1 || !Number.isSafeInteger(authVersion) || user.authVersion !== authVersion) {
    return null
  }

  return toSessionUser(user)
}

export async function syncApiUserSession(event: H3Event, sessionUser: User, currentUser: User) {
  if (!isSameSessionUser(sessionUser, currentUser)) {
    await replaceSessionUser(event, currentUser)
  }
}

// setUserSession は既存のセッションと defu でマージし、null の値を無視する。
// avatar を null に戻した変更なども反映されるよう、ユーザー情報は丸ごと置き換える。
export async function replaceSessionUser(event: H3Event, user: User) {
  const { id: _sessionId, ...session } = await getUserSession(event)
  await replaceUserSession(event, { ...session, user })
}

export async function requireApiUser(event: H3Event) {
  const session = await requireUserSession(event, { message: 'Unauthorized.' })
  const user = await findActiveApiUser(session.user.id, session.user.authVersion)

  if (!user) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  await syncApiUserSession(event, session.user, user)
  return user
}

export async function requireApiAdmin(event: H3Event) {
  const user = await requireApiUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden.' })
  }

  return user
}
