import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Page } from '~/types'

type DeletePageRequest = {
  path?: string
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody<DeletePageRequest>(event)
  const path = payload.path?.trim()

  if (!path) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const client = await serverSupabaseClient(event)
  const { data: latest, error: latestError } = await client
    .from('pages')
    .select('*')
    .eq('path', path)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle<Page>()

  if (latestError) {
    throw createError({ statusCode: 500, message: latestError.message })
  }

  if (!latest || latest.body === '') {
    throw createError({ statusCode: 404, message: 'Page not found or already deleted.' })
  }

  const nextRevision = latest.revision + 1
  const { data: inserted, error: insertError } = await client
    .from('pages')
    .insert({
      path,
      revision: nextRevision,
      body: '',
      message: 'ページ削除',
      created_by: user.sub,
      updated_by: user.sub
    })
    .select('*')
    .single<Page>()

  if (insertError) {
    throw createError({ statusCode: 500, message: insertError.message })
  }

  return inserted
})
