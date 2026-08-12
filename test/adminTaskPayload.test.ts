import { describe, expect, test } from 'bun:test'
import { parseBackfillCommentAstPayload, parseRebuildPageSearchPayload } from '../server/utils/adminTaskPayload'

describe('admin task payloads', () => {
  test('clamps comment AST backfill limits and trims an optional path', () => {
    expect(parseBackfillCommentAstPayload(undefined)).toEqual({ limit: 100 })
    expect(parseBackfillCommentAstPayload({ limit: 0, path: ' target/path ' })).toEqual({
      limit: 1,
      path: 'target/path'
    })
    expect(parseBackfillCommentAstPayload({ limit: 9999, path: ' ' })).toEqual({ limit: 500 })
    expect(parseBackfillCommentAstPayload({ limit: 'invalid' })).toEqual({ limit: 100 })
  })

  test('clamps search rebuild limits and derives reset from cursor presence', () => {
    expect(parseRebuildPageSearchPayload(undefined)).toEqual({ limit: 50, reset: true })
    expect(parseRebuildPageSearchPayload({ limit: 0, cursor: ' page/a ' })).toEqual({
      limit: 1,
      reset: false,
      cursor: 'page/a'
    })
    expect(parseRebuildPageSearchPayload({ limit: 9999, cursor: 'page/a', reset: true })).toEqual({
      limit: 200,
      reset: true,
      cursor: 'page/a'
    })
    expect(parseRebuildPageSearchPayload({ limit: Number.NaN, reset: 'yes' })).toEqual({
      limit: 50,
      reset: true
    })
  })
})
