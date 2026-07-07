import type { H3Event } from 'h3'

export const CDN_CACHE_TTL = {
  pageLatest: 60 * 60 * 24,
  pageRevision: 60 * 60 * 24 * 30,
  image: 60 * 60 * 24 * 30,
  commentList: 60 * 15,
  recentList: 60 * 10,
  sitemap: 60 * 60 * 24
} as const

export function setPublicCdnCacheHeaders(
  event: H3Event,
  maxAge: number,
  options: { browser?: 'no-store' | 'same'; immutable?: boolean } = {}
) {
  const value = `public, max-age=${maxAge}${options.immutable ? ', immutable' : ''}`

  setResponseHeader(event, 'Cache-Control', options.browser === 'same' ? value : 'no-store')
  setResponseHeader(event, 'Cloudflare-CDN-Cache-Control', value)
  setResponseHeader(event, 'CDN-Cache-Control', value)
}

export function setNoStoreCacheHeaders(event: H3Event) {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Cloudflare-CDN-Cache-Control', 'no-store')
  setResponseHeader(event, 'CDN-Cache-Control', 'no-store')
}
