import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Page } from '~/types'

type RestorePageRequest = {
  path?: string
  targetRevision?: number
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const payload = await readBody<RestorePageRequest>(event)
  const path = payload.path?.trim()
  const targetRevision = payload.targetRevision ?? -1

  if (!path || !Number.isInteger(targetRevision) || targetRevision < 1) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  const client = await serverSupabaseClient(event)
  const { data: targetPage, error: targetError } = await client
    .from('pages')
    .select('*')
    .eq('path', path)
    .eq('revision', targetRevision)
    .maybeSingle<Page>()

  if (targetError) {
    throw createError({ statusCode: 500, message: targetError.message })
  }

  if (!targetPage) {
    throw createError({ statusCode: 404, message: 'Target revision not found.' })
  }

  const { data: latest, error: latestError } = await client
    .from('pages')
    .select('revision')
    .eq('path', path)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle<{ revision: number }>()

  if (latestError) {
    throw createError({ statusCode: 500, message: latestError.message })
  }

  const nextRevision = (latest?.revision ?? 0) + 1
  const { data: inserted, error: insertError } = await client
    .from('pages')
    .insert({
      path,
      revision: nextRevision,
      body: targetPage.body,
      message: `Restore revision ${targetRevision}`,
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
