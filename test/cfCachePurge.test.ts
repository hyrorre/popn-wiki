import { describe, expect, test } from 'bun:test'
import { getPageMutationPurgeUrls, getWikiPagePurgeUrl } from '../server/utils/cfCachePurge'

describe('Cloudflare cache purge URLs', () => {
  test('normalizes wiki page URLs', () => {
    expect(getWikiPagePurgeUrl('/')).toBe('https://popn.wiki/')
    expect(getWikiPagePurgeUrl('genre/popn')).toBe('https://popn.wiki/genre/popn')
    expect(getWikiPagePurgeUrl('/genre/popn')).toBe('https://popn.wiki/genre/popn')
  })

  test('encodes wiki page URLs without changing API purge query encoding', () => {
    expect(getWikiPagePurgeUrl('ジャンル/ポップン')).toBe(
      'https://popn.wiki/%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%AB/%E3%83%9D%E3%83%83%E3%83%97%E3%83%B3'
    )
    expect(getWikiPagePurgeUrl('genre/query?hash#part')).toBe('https://popn.wiki/genre/query%3Fhash%23part')

    expect(getPageMutationPurgeUrls('/genre/popn')).toContain('https://popn.wiki/api/page?path=%2Fgenre%2Fpopn')
  })
})
