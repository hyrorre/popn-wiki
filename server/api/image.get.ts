import { blob } from '@nuxthub/blob'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const basePath = String(config.public.imageBasePath || '/api/image').replace(/\/$/, '')
  const { blobs } = await blob.list()

  return blobs.map((b) => {
    return {
      name: b.pathname,
      url: `${basePath}/${String(b.pathname).replace(/^\/+/, '')}`,
      created_at: b.uploadedAt
    }
  })
})
