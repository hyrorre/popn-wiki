import { describe, expect, test } from 'bun:test'
import { legacyImageRedirectPath } from '../utils/legacyImage'

describe('legacy image redirects', () => {
  test('sends every supported image type under both legacy prefixes to the image API', () => {
    for (const prefix of ['/score/start/', '/_media/score/start/']) {
      for (const filename of ['chart.png', 'chart.jpg', 'chart.jpeg', 'diff.gif', 'chart.webp', 'DIFF.GIF']) {
        expect(legacyImageRedirectPath(`${prefix}${filename}`)).toBe(`/api/image/${filename}`)
      }
    }
  })

  test('keeps percent-encoded filenames and queries as received', () => {
    const filename = encodeURIComponent('日本語.gif')

    expect(legacyImageRedirectPath(`/score/start/${filename}`, '?download=1')).toBe(`/api/image/${filename}?download=1`)
  })

  test('leaves other files and paths to the wiki', () => {
    for (const path of [
      '/score/start/file.svg',
      '/_media/score/start/file.txt',
      '/score/start/second.gif/',
      '/other/score/start/chart.png',
      '/難易度表/lv50'
    ]) {
      expect(legacyImageRedirectPath(path)).toBeNull()
    }
  })
})
