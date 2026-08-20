import { findActiveApiUser, syncApiUserSession } from '~/server/utils/authorization'

export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (!session.user) {
      return
    }

    const user = await findActiveApiUser(session.user.id)
    if (!user) {
      delete session.user
      await clearUserSession(event)
      return
    }

    await syncApiUserSession(event, session.user, user)
    session.user = user
  })
})
