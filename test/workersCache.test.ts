import { describe, expect, test } from 'bun:test'
import { createEvent } from 'h3'
import type { IncomingMessage as NodeIncomingMessage, ServerResponse as NodeServerResponse } from 'node:http'
import { IncomingMessage, ServerResponse } from 'node-mock-http'
import {
  getPageMutationWorkersCacheTags,
  getPageResponseWorkersCacheTags,
  getRecentCommentsWorkersCacheTags,
  getRecentPagesWorkersCacheTags,
  getSitemapWorkersCacheTags,
  purgeWorkersCacheByTags
} from '../server/utils/workersCache'

function createTestEvent() {
  const request = new IncomingMessage()
  request.method = 'POST'
  request.url = '/api/page'
  const nodeRequest = request as unknown as NodeIncomingMessage
  const response = new ServerResponse(nodeRequest)

  return createEvent(nodeRequest, response as unknown as NodeServerResponse)
}

describe('Workers Cache', () => {
  test('page mutations invalidate every page-title-dependent response', () => {
    const path = 'genre/popn'
    const mutationTags = getPageMutationWorkersCacheTags(path)
    const latestPageTag = getPageResponseWorkersCacheTags(path)[1]!

    expect(mutationTags).toContain(latestPageTag)
    expect(mutationTags).toContain(getSitemapWorkersCacheTags()[0]!)
    expect(mutationTags).toContain(getRecentPagesWorkersCacheTags()[0]!)
    expect(mutationTags).toContain(getRecentCommentsWorkersCacheTags()[0]!)
  })

  test('purges normalized tags through the Cloudflare execution context', async () => {
    const event = createTestEvent()
    let receivedTags: string[] | undefined
    event.context.cloudflare = {
      context: {
        cache: {
          async purge(options: { tags?: string[] }) {
            receivedTags = options.tags
            return { success: true }
          }
        }
      }
    }

    const success = await purgeWorkersCacheByTags(event, ['tag-a', 'tag-a', 'invalid tag', 'tag-b'])

    expect(success).toBe(true)
    expect(receivedTags).toEqual(['tag-a', 'tag-b'])
  })
})
