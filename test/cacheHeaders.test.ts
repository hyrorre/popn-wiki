import { describe, expect, test } from 'bun:test'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node-mock-http'
import type { IncomingMessage as NodeIncomingMessage, ServerResponse as NodeServerResponse } from 'node:http'
import {
  setNoStoreCacheHeaders,
  setPublicCdnCacheHeaders
} from '../server/utils/cacheHeaders'
import cacheControlMiddleware from '../server/middleware/cache-control'

function createTestEvent() {
  const request = new IncomingMessage()
  request.method = 'GET'
  request.url = '/'
  const nodeRequest = request as unknown as NodeIncomingMessage
  const response = new ServerResponse(nodeRequest)

  return { event: createEvent(nodeRequest, response as unknown as NodeServerResponse), response }
}

describe('cache response headers', () => {
  test('defaults dynamic responses to no-store', () => {
    const { event, response } = createTestEvent()

    cacheControlMiddleware(event)

    expect(response.getHeader('Cache-Control')).toBe('no-store')
    expect(response.getHeader('Cloudflare-CDN-Cache-Control')).toBe('no-store')
    expect(response.getHeader('CDN-Cache-Control')).toBe('no-store')
  })

  test('allows explicit public CDN caching without browser caching', () => {
    const { event, response } = createTestEvent()

    setNoStoreCacheHeaders(event)
    setPublicCdnCacheHeaders(event, 3600)

    expect(response.getHeader('Cache-Control')).toBe('no-store')
    expect(response.getHeader('Cloudflare-CDN-Cache-Control')).toBe('public, max-age=3600')
    expect(response.getHeader('CDN-Cache-Control')).toBe('public, max-age=3600')
  })
})
