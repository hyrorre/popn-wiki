import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Profile } from '~/types'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const client = await serverSupabaseClient(event)

  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const { data } = await client.from('profiles').select().eq('id', user.sub).single<Profile>()
  return data
})
