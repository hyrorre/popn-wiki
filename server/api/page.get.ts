import { serverSupabaseClient } from '#supabase/server'
import type { Page } from '~/types'

export default defineEventHandler(async (event) => {
  const query = (await getQuery(event)) as { path?: string; revision?: string }
  if (!query.path) {
    throw createError({ status: 400 })
  }

  const client = await serverSupabaseClient(event)
  if (query.revision !== undefined) {
    const requestedRevision = Number.parseInt(query.revision, 10)
    if (!Number.isInteger(requestedRevision) || requestedRevision < 1) {
      throw createError({ statusCode: 400, message: 'Invalid revision.' })
    }

    const { data, error } = await client
      .from('pages')
      .select('*')
      .eq('path', query.path)
      .eq('revision', requestedRevision)
      .maybeSingle<Page>()

    if (error) {
      throw createError({ statusCode: 500, message: error.message })
    }

    if (!data) {
      throw createError({ statusCode: 404, message: 'Page not found.' })
    }

    return data
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .eq('path', query.path)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle<Page>()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, message: 'Page not found.' })
  }

  return data
})
