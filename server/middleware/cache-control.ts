import { defineEventHandler } from 'h3'
import { setNoStoreCacheHeaders } from '~/server/utils/cacheHeaders'

export default defineEventHandler((event) => {
  setNoStoreCacheHeaders(event)
})
