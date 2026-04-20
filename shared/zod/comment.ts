import * as z from 'zod'
import { commentBodySchema, positiveIntSchema, wikiPathSchema } from './common'

export const createCommentSchema = z.object({
  path: wikiPathSchema,
  body: commentBodySchema,
  replyTo: positiveIntSchema.nullish().transform((value) => value ?? null)
})

export const updateCommentSchema = z.object({
  id: positiveIntSchema,
  body: commentBodySchema
})

export type CreateCommentInput = z.output<typeof createCommentSchema>
export type UpdateCommentInput = z.output<typeof updateCommentSchema>
