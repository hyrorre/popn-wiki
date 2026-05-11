import * as z from 'zod'
import { nonNegativeIntSchema, pageBodySchema, pageMessageSchema, positiveIntSchema, wikiPathSchema } from './common'

export const updatePageSchema = z.object({
  path: wikiPathSchema,
  body: pageBodySchema,
  baseRevision: nonNegativeIntSchema,
  message: pageMessageSchema,
  minor: z
    .union([z.literal(0), z.literal(1)])
    .optional()
    .default(0)
})

export type UpdatePageInput = z.output<typeof updatePageSchema>

export const restorePageSchema = z.object({
  path: wikiPathSchema,
  targetRevision: positiveIntSchema
})

export type RestorePageInput = z.output<typeof restorePageSchema>
