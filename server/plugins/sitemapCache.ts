import { getRequestURL, getResponseStatus } from 'h3'
import { defineNitroPlugin } from 'nitropack/runtime'
import { CDN_CACHE_TTL, setPublicCdnCacheHeaders } from '~/server/utils/cacheHeaders'
import { getSitemapWorkersCacheTags, setWorkersCacheTags } from '~/server/utils/workersCache'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    if (getRequestURL(event).pathname !== '/sitemap.xml' || getResponseStatus(event) >= 400) {
      return
    }

    setPublicCdnCacheHeaders(event, CDN_CACHE_TTL.sitemap)
    setWorkersCacheTags(event, getSitemapWorkersCacheTags())
  })
})
