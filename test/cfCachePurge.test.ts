import { describe, expect, test } from 'bun:test'
import { getCommentMutationPurgePrefixes, getPageMutationPurgePrefixes } from '../server/utils/cfCachePurge'

describe('Cloudflare cache purge prefixes', () => {
  test('purges every page-dependent API path', () => {
    expect(getPageMutationPurgePrefixes()).toEqual([
      'popn.wiki/api/page',
      'popn.wiki/api/comment/recent',
      'popn.wiki/api/sitemap',
      'popn.wiki/sitemap.xml'
    ])
  })

  test('purges every query variant of comment APIs', () => {
    expect(getCommentMutationPurgePrefixes()).toEqual(['popn.wiki/api/comment'])
  })
})
