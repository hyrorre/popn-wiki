import { describe, expect, test } from 'bun:test'
import {
  parseClampedInteger,
  parseIntegerOrFallback,
  parseStrictIntegerQuery
} from '../server/utils/queryInteger'

describe('integer query parsing', () => {
  test('truncates and clamps bounded integers while falling back for non-numeric values', () => {
    const options = { fallback: 10, minimum: 1, maximum: 50 }

    expect(parseClampedInteger(undefined, options)).toBe(10)
    expect(parseClampedInteger('invalid', options)).toBe(10)
    expect(parseClampedInteger('-5', options)).toBe(1)
    expect(parseClampedInteger('2.9', options)).toBe(2)
    expect(parseClampedInteger('100', options)).toBe(50)
  })

  test('supports both numeric and legacy leading-integer fallback behavior', () => {
    const options = { fallback: 1, minimum: 1 }

    expect(parseIntegerOrFallback('2.9', options)).toBe(2)
    expect(parseIntegerOrFallback('2abc', options)).toBe(1)
    expect(parseIntegerOrFallback('0.9', options)).toBe(1)
    expect(parseIntegerOrFallback('2abc', { ...options, syntax: 'leading' })).toBe(2)
    expect(parseIntegerOrFallback(undefined, { ...options, syntax: 'leading' })).toBe(1)
  })

  test('requires exact integers, applies defaults, and caps accepted values', () => {
    const options = { fallback: 20, minimum: 1, maximum: 100 }

    expect(parseStrictIntegerQuery(undefined, options)).toBe(20)
    expect(parseStrictIntegerQuery('25', options)).toBe(25)
    expect(parseStrictIntegerQuery('200', options)).toBe(100)
    expect(() => parseStrictIntegerQuery('2.5', options)).toThrow('Invalid pagination.')
    expect(() => parseStrictIntegerQuery('invalid', options)).toThrow('Invalid pagination.')
  })

  test('preserves endpoint-specific validation messages', () => {
    expect(() =>
      parseStrictIntegerQuery(undefined, { minimum: 1, message: 'ID is required.' })
    ).toThrow('ID is required.')
  })
})
