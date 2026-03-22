import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const { data: files, error } = await client.storage
    .from('image')
    .list('', {
      sortBy: { column: 'created_at', order: 'desc' }
    })

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  // .emptyFolderPlaceholder などのシステムファイルを除外
  const images = (files ?? []).filter((f) => f.name && !f.name.startsWith('.'))

  return images.map((f) => {
    const { data } = client.storage.from('image').getPublicUrl(f.name)
    return {
      name: decodeURIComponent(f.name),
      url: data.publicUrl,
      created_at: f.created_at
    }
  })
})
