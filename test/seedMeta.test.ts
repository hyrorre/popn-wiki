import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, test } from 'bun:test'

async function loadSeedTask() {
  Object.assign(globalThis, {
    defineTask: (task: unknown) => task
  })

  return await import('../server/tasks/seed')
}

let tempDirs: string[] = []

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'popn-wiki-seed-meta-'))
  tempDirs.push(dir)
  return dir
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  tempDirs = []
})

describe('DokuWiki page metadata seed timestamps', () => {
  test('extracts timestamps from persistent date fields', async () => {
    const { extractPageSeedTimestamps } = await loadSeedTask()

    expect(
      extractPageSeedTimestamps({
        current: {
          date: {
            created: 100,
            modified: 200
          }
        },
        persistent: {
          date: {
            created: 1544717580,
            modified: 1546348481
          }
        }
      })
    ).toEqual({
      createdAt: '2018-12-13T16:13:00.000Z',
      updatedAt: '2019-01-01T13:14:41.000Z'
    })
  })

  test('falls back to current date fields and uses createdAt when modified is missing', async () => {
    const { extractPageSeedTimestamps } = await loadSeedTask()

    expect(
      extractPageSeedTimestamps({
        current: {
          date: {
            created: 1544717580
          }
        }
      })
    ).toEqual({
      createdAt: '2018-12-13T16:13:00.000Z',
      updatedAt: '2018-12-13T16:13:00.000Z'
    })
  })

  test('uses a fixed timestamp when page metadata is missing', async () => {
    const { resolvePageSeedTimestamps } = await loadSeedTask()

    expect(resolvePageSeedTimestamps(undefined)).toEqual({
      createdAt: '2018-01-01T09:00:00.000Z',
      updatedAt: '2018-01-01T09:00:00.000Z'
    })
  })

  test('collects root, nested, and URL-encoded .meta paths', async () => {
    const { collectPageSeedTimestamps } = await loadSeedTask()
    const metaDir = createTempDir()

    writeFile(
      path.join(metaDir, 'start.meta'),
      'a:1:{s:10:"persistent";a:1:{s:4:"date";a:2:{s:7:"created";i:1544717580;s:8:"modified";i:1546348481;}}}'
    )
    writeFile(
      path.join(metaDir, 'music', 'oto_ex.meta'),
      'a:1:{s:7:"current";a:1:{s:4:"date";a:2:{s:7:"created";i:1544718004;s:8:"modified";i:1544753913;}}}'
    )
    writeFile(
      path.join(metaDir, '%E6%96%B0%E3%83%9D%E3%83%97%E3%81%A8%E3%82%82id%E8%A1%A8.meta'),
      'a:1:{s:10:"persistent";a:1:{s:4:"date";a:2:{s:7:"created";i:1663580198;s:8:"modified";i:1776564982;}}}'
    )
    writeFile(path.join(metaDir, 'broken.meta'), 'not serialized')

    const timestamps = collectPageSeedTimestamps(metaDir)

    expect(timestamps.get('/')).toEqual({
      createdAt: '2018-12-13T16:13:00.000Z',
      updatedAt: '2019-01-01T13:14:41.000Z'
    })
    expect(timestamps.get('music/oto_ex')).toEqual({
      createdAt: '2018-12-13T16:20:04.000Z',
      updatedAt: '2018-12-14T02:18:33.000Z'
    })
    expect(timestamps.get('新ポプともid表')).toEqual({
      createdAt: '2022-09-19T09:36:38.000Z',
      updatedAt: '2026-04-19T02:16:22.000Z'
    })
    expect(timestamps.has('broken')).toBe(false)
  })
})
