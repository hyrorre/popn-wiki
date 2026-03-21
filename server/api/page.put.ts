import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Page } from '~/types'

type UpdatePageRequest = {
  path?: string
  body?: string
  baseRevision?: number
  message?: string
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody<UpdatePageRequest>(event)
  const path = payload.path?.trim()
  const body = payload.body
  const baseRevision = payload.baseRevision ?? -1

  if (!path || typeof body !== 'string' || !Number.isInteger(baseRevision) || baseRevision < 0) {
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

  const latestRevision = latest?.revision ?? 0
  if (baseRevision !== latestRevision) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Revision conflict.',
      data: { latestRevision }
    })
  }

  const nextRevision = latestRevision + 1
  const { data: inserted, error: insertError } = await client
    .from('pages')
    .insert({
      path,
      revision: nextRevision,
      body,
      message: payload.message?.trim() || null,
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
