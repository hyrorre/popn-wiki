import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const { error } = await client.auth.admin.deleteUser(user.sub)
  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return { message: 'User deleted.' }
})
