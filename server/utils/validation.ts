import type { H3Event } from 'h3'
import type { z } from 'zod'

export async function readZodBody<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.output<T>> {
  const result = schema.safeParse(await readBody(event))

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid payload.',
      data: result.error.flatten()
    })
  }

  return result.data
}
