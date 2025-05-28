import { serverSupabaseClient } from '#supabase/server'
import type { Config } from '~/types'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data, error } = await client.from('configs').select('*').single<Config>()

  if (error) {
    throw createError({ status: 500 })
  }

  return data
})
