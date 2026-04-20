import * as z from 'zod'
import { avatarSchema, userNameSchema } from './common'

export const updateProfileSchema = z.object({
  name: userNameSchema,
  avatar: avatarSchema
})

export type UpdateProfileInput = z.output<typeof updateProfileSchema>
