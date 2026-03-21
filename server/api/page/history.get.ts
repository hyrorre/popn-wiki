import { serverSupabaseClient } from '#supabase/server'
import type { Page } from '~/types'

export default defineEventHandler(async (event) => {
  const query = (await getQuery(event)) as { path?: string }
  if (!query.path) {
    throw createError({ statusCode: 400, message: 'Path is required.' })
  }

  const client = await serverSupabaseClient(event)
  const { data, error } = await client
    .from('pages')
    .select('*')
    .eq('path', query.path)
    .order('revision', { ascending: false })
    .returns<Page[]>()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data ?? []
})
