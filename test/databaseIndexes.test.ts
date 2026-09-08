import { Database } from 'bun:sqlite'
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'

const database = new Database(':memory:')
const migrations = new URL('../server/db/migrations/', import.meta.url)
for (const file of readdirSync(migrations)
  .filter((file) => file.endsWith('.sql'))
  .sort()) {
  database.exec(readFileSync(new URL(file, migrations), 'utf8'))
}
afterAll(() => database.close())

function plan(sql: string) {
  return (database.query(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>)
    .map((row) => row.detail)
    .join('\n')
}

describe('migrated database lookup indexes', () => {
  test('reply lookup supports both visible children and traversal through deleted ancestors', () => {
    for (const condition of ['', ' AND deleted_at IS NULL', " AND path = 'target' AND deleted_at IS NULL"]) {
      const details = plan(`SELECT id FROM comments WHERE reply_to = 1${condition}`)
      expect(details).toContain('SEARCH comments USING COVERING INDEX comments_reply_idx (reply_to=')
      expect(details).not.toContain('AUTOMATIC')
    }
  })

  test('root pagination excludes replies in its ordered index', () => {
    const details = plan(`SELECT id FROM comments
      WHERE path = 'target' AND reply_to IS NULL AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 20`)
    expect(details).toContain('comments_roots_recent_idx')
    expect(details).not.toContain('TEMP B-TREE')
  })

  test('participation lookup starts with the user and does not sort the entire comment table', () => {
    const details = plan('SELECT id, reply_to FROM comments WHERE user_id = 1 ORDER BY created_at DESC LIMIT 1000')
    expect(details).toContain('SEARCH comments USING INDEX comments_user_recent_idx (user_id=')
    expect(details).not.toContain('TEMP B-TREE')
  })

  test('newer major and deleted revisions use filtered path ranges', () => {
    const major = plan(`SELECT 1 FROM pages WHERE path = 'target' AND revision > 1
      AND body != '' AND (minor IS NULL OR minor = 0)`)
    const deleted = plan("SELECT 1 FROM pages WHERE path = 'target' AND revision > 1 AND body = ''")
    expect(major).toContain('pages_major_path_idx (path=? AND revision>?)')
    expect(deleted).toContain('pages_deleted_path_idx (path=? AND revision>?)')
  })
})
