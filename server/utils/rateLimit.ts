import type { H3Event } from 'h3'
import { kv } from '@nuxthub/kv'

type RateLimitOptions = {
  /** キーのプレフィックス（エンドポイント識別用） */
  key: string
  /** ウィンドウ内の最大リクエスト数 */
  limit: number
  /** ウィンドウの秒数（最小60） */
  window?: number
}

/**
 * Fixed Window Counter 方式のレート制限。
 * hubKV() を使い、Cloudflare Workers の複数インスタンス間で共有される。
 *
 * @throws 429 Too Many Requests — 制限を超えた場合
 */
export async function checkRateLimit(event: H3Event, options: RateLimitOptions) {
  const { key, limit, window = 60 } = options

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const kvKey = `rl:${key}:${ip}`

  const current = (await kv.getItem<number>(kvKey)) || 0

  const remaining = Math.max(0, limit - current - 1)
  setResponseHeader(event, 'X-RateLimit-Limit', limit.toString())
  setResponseHeader(event, 'X-RateLimit-Remaining', remaining.toString())

  if (current >= limit) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests. Please try again later.'
    })
  }

  await kv.setItem(kvKey, current + 1, { ttl: window })
}
