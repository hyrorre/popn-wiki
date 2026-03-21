import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Comment } from '~/types'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody(event)
  const path = payload.path?.trim()
  const body = payload.body?.trim()
  const reply_to = payload.reply_to || null

  if (!path || !body) {
    throw createError({ statusCode: 400, message: 'Path and body are required.' })
  }

  const client = await serverSupabaseClient(event)
  const { data, error } = await client
    .from('comments')
    .insert({
      path,
      body,
      reply_to,
      user_id: user.id
    })
    .select('*, profiles:user_id(id, name)')
    .single<Comment>()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
