import { serverSupabaseClient } from '#supabase/server'
import type { Page } from '~/types'

export default defineEventHandler(async (event) => {
  const query = (await getQuery(event)) as { path?: string }
  if (!query.path) {
    throw createError({ status: 400 })
  }

  const client = await serverSupabaseClient(event)
  const { data, error } = await client.from('pages').select('*').eq('path', query.path).single<Page>()

  if (error) {
    throw createError({ status: 500 })
  }

  return data
})
