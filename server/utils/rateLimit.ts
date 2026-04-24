import type { H3Event } from 'h3'

type RateLimitOptions = {
  /** キーのプレフィックス（エンドポイント識別用） */
  key: string
  /** ウィンドウ内の最大リクエスト数 */
  limit: number
  /** ウィンドウの秒数（最小60） */
  window?: number
}

const localCounters = new Map<string, { count: number; expiresAt: number }>()

/**
 * Fixed Window Counter 方式のレート制限。
 * NuxtHub KV/Nitro storage を使い、Cloudflare Workers の複数インスタンス間で共有される。
 *
 * @throws 429 Too Many Requests — 制限を超えた場合
 */
export async function checkRateLimit(event: H3Event, options: RateLimitOptions) {
  const { key, limit, window = 60 } = options

  const ip = getClientIP(event)
  const kvKey = `rl:${key}:${ip}`

  const storage = useStorage('kv')
  const current = await getCounter(storage, kvKey)

  const remaining = Math.max(0, limit - current - 1)
  setResponseHeader(event, 'X-RateLimit-Limit', limit.toString())
  setResponseHeader(event, 'X-RateLimit-Remaining', remaining.toString())

  if (current >= limit) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests. Please try again later.'
    })
  }

  await setCounter(storage, kvKey, current + 1, window)
}

async function getCounter(storage: ReturnType<typeof useStorage>, key: string) {
  try {
    return (await storage.getItem<number>(key)) || 0
  } catch (error) {
    if (!isLocalDev()) {
      throw error
    }
    return getLocalCounter(key)
  }
}

async function setCounter(storage: ReturnType<typeof useStorage>, key: string, count: number, ttl: number) {
  try {
    await storage.setItem(key, count, { ttl })
  } catch (error) {
    if (!isLocalDev()) {
      throw error
    }
    setLocalCounter(key, count, ttl)
  }
}

function getLocalCounter(key: string) {
  const now = Date.now()
  const entry = localCounters.get(key)
  if (!entry || entry.expiresAt <= now) {
    localCounters.delete(key)
    return 0
  }
  return entry.count
}

function setLocalCounter(key: string, count: number, ttl: number) {
  localCounters.set(key, {
    count,
    expiresAt: Date.now() + ttl * 1000
  })
}

function isLocalDev() {
  return process.env.NODE_ENV !== 'production'
}

function getClientIP(event: H3Event) {
  return (
    getRequestHeader(event, 'cf-connecting-ip') ||
    getRequestHeader(event, 'true-client-ip') ||
    getRequestIP(event, { xForwardedFor: true }) ||
    getRequestHeader(event, 'x-real-ip') ||
    'unknown'
  )
}
