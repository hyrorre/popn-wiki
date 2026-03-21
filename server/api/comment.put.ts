import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Comment } from '~/types'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody(event)
  const id = payload.id
  const body = payload.body?.trim()

  if (!id || !body) {
    throw createError({ statusCode: 400, message: 'ID and body are required.' })
  }

  const client = await serverSupabaseClient(event)
  
  // DB level RLS should ensure users can only update their own comments, or eq('user_id', user.sub)
  const { data, error } = await client
    .from('comments')
    .update({ 
      body, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .eq('user_id', user.sub)
    .select('*, profiles:user_id(id, name)')
    .single<Comment>()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, message: 'Comment not found or not owned by user.' })
  }

  return data
})
