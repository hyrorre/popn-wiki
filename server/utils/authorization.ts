import type { H3Event } from 'h3'

export async function requireApiUser(event: H3Event) {
  const session = await requireUserSession(event, { message: 'Unauthorized.' })
  return session.user
}

export async function requireApiAdmin(event: H3Event) {
  const user = await requireApiUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Forbidden.' })
  }

  return user
}
