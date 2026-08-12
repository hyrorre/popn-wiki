import { createError, getQuery, readBody, type H3Event } from 'h3'
import type { z } from 'zod'

type ZodValidationOptions = {
  message?: string
}

export function parseZodValue<T extends z.ZodType>(
  value: unknown,
  schema: T,
  options: ZodValidationOptions = {}
): z.output<T> {
  const result = schema.safeParse(value)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: options.message ?? 'Invalid payload.',
      data: result.error.flatten()
    })
  }

  return result.data
}

export async function readZodBody<T extends z.ZodType>(
  event: H3Event,
  schema: T,
  options?: ZodValidationOptions
): Promise<z.output<T>> {
  return parseZodValue(await readBody(event), schema, options)
}

export function parseZodQuery<T extends z.ZodType>(
  event: H3Event,
  schema: T,
  options: ZodValidationOptions = { message: 'Invalid query.' }
): z.output<T> {
  return parseZodValue(getQuery(event), schema, options)
}
