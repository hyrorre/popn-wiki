import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const formData = await readMultipartFormData(event)
  const file = formData?.find((f) => f.name === 'file')

  if (!file || !file.filename || !file.data?.length) {
    throw createError({ statusCode: 400, message: 'ファイルが指定されていません。' })
  }

  // 拡張子チェック
  const ext = file.filename.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw createError({
      statusCode: 400,
      message: `許可されていないファイル形式です。(${ALLOWED_EXTENSIONS.join(', ')})`
    })
  }

  // サイズチェック
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, message: 'ファイルサイズは5MB以下にしてください。' })
  }

  // オリジナルファイル名をURLエンコード
  const encodedName = encodeURIComponent(file.filename)

  const client = await serverSupabaseClient(event)

  // upsert: false で衝突時エラー
  const { error: uploadError } = await client.storage
    .from('image')
    .upload(encodedName, file.data, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    })

  if (uploadError) {
    if (uploadError.message?.includes('already exists') || uploadError.message?.includes('Duplicate')) {
      throw createError({
        statusCode: 409,
        message: `同名のファイルが既に存在します: ${file.filename}`
      })
    }
    throw createError({ statusCode: 500, message: uploadError.message })
  }

  const { data: publicUrlData } = client.storage
    .from('image')
    .getPublicUrl(encodedName)

  return {
    url: publicUrlData.publicUrl,
    filename: file.filename
  }
})
