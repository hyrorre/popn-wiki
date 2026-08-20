import { createError } from 'h3'

type IntegerBounds = {
  minimum: number
  maximum?: number
}

type IntegerFallbackOptions = IntegerBounds & {
  fallback: number
}

type StrictIntegerQueryOptions = IntegerBounds & {
  fallback?: number
  message?: string
}

export function parseClampedInteger(value: unknown, options: IntegerFallbackOptions) {
  const parsed = parseNumericValue(value)
  if (!Number.isFinite(parsed)) return options.fallback

  const integer = Math.max(Math.trunc(parsed), options.minimum)
  return options.maximum === undefined ? integer : Math.min(integer, options.maximum)
}

export function parseIntegerOrFallback(value: unknown, options: IntegerFallbackOptions) {
  const parsed = parseNumericValue(value)

  if (!Number.isFinite(parsed) || parsed < options.minimum) return options.fallback

  const integer = Math.trunc(parsed)
  return options.maximum === undefined ? integer : Math.min(integer, options.maximum)
}

export function parseStrictIntegerQuery(value: unknown, options: StrictIntegerQueryOptions) {
  if (value === undefined && options.fallback !== undefined) return options.fallback

  const parsed = parseNumericValue(value)
  if (!Number.isInteger(parsed) || parsed < options.minimum) {
    throw createError({ statusCode: 400, message: options.message ?? 'Invalid pagination.' })
  }

  return options.maximum === undefined ? parsed : Math.min(parsed, options.maximum)
}

function parseNumericValue(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return Number.NaN
  if (typeof value === 'string' && value.trim() === '') return Number.NaN

  return Number(value)
}
