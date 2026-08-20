import { requireApiUser } from '~/server/utils/authorization'

export default defineEventHandler(async (event) => {
  const user = await requireApiUser(event)

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar
  }
})
