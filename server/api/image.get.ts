import { blob } from '@nuxthub/blob'

export default defineEventHandler(async () => {
  const { blobs } = await blob.list()

  return blobs.map((b) => {
    return {
      name: b.pathname,
      url: `/api/_hub/blob/${b.pathname}`, // または単に b.pathname
      created_at: b.uploadedAt
    }
  })
})
