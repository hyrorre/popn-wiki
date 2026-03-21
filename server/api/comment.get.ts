import { serverSupabaseClient } from '#supabase/server'
import type { Comment } from '~/types'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = query.path as string

  if (!path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  const client = await serverSupabaseClient(event)
  const { data, error } = await client
    .from('comments')
    .select('*, profiles:user_id(id, name)')
    .eq('path', path)
    .order('created_at', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
