import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { parseZodValue } from '../server/utils/validation'

const querySchema = z.object({
  q: z.string().trim().min(2),
  page: z.coerce.number().int().positive().default(1)
})

describe('Zod request validation', () => {
  test('returns parsed and normalized values', () => {
    expect(parseZodValue({ q: ' keyword ', page: '2' }, querySchema)).toEqual({
      q: 'keyword',
      page: 2
    })
  })

  test('returns a 400 error with flattened validation details', () => {
    expect(() => parseZodValue({ q: 'x', page: 'invalid' }, querySchema)).toThrow(
      expect.objectContaining({
        statusCode: 400,
        message: 'Invalid payload.',
        data: expect.objectContaining({
          fieldErrors: expect.objectContaining({ q: expect.any(Array), page: expect.any(Array) })
        })
      })
    )
  })

  test('supports endpoint-specific error messages', () => {
    expect(() => parseZodValue({}, querySchema, { message: 'Invalid query.' })).toThrow(
      expect.objectContaining({ statusCode: 400, message: 'Invalid query.' })
    )
  })
})
