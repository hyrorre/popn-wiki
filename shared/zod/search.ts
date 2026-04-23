import * as z from 'zod'

const parseInteger = (value: unknown) => {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number.parseInt(value, 10)
  }

  return undefined
}

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, '検索語は2文字以上で入力してください')
    .max(100, '検索語は100文字以内で入力してください'),
  page: z.preprocess(
    parseInteger,
    z.number().int().min(1, 'ページ番号が不正です').optional().default(1)
  ),
  limit: z.preprocess(
    parseInteger,
    z.number().int().min(1, '件数が不正です').max(50, '件数は50件以下で指定してください').optional().default(20)
  )
})

export type SearchQueryInput = z.output<typeof searchQuerySchema>
