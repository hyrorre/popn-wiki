const RECENT_COMMENTS_VERSION_KEY = 'recent:comments:version'
export const RECENT_COMMENTS_TTL = 60 * 60

export function getRecentCommentsCacheKey(params: { limit: number; page: number }, version: string) {
  return `recent:comments:v=${version}:limit=${params.limit}:page=${params.page}`
}

export async function getRecentCommentsCacheVersion(): Promise<string> {
  return (await useStorage('cache').getItem<string>(RECENT_COMMENTS_VERSION_KEY)) ?? '0'
}

export async function invalidateRecentCommentsCache(): Promise<void> {
  await useStorage('cache').setItem(RECENT_COMMENTS_VERSION_KEY, `${Date.now()}:${crypto.randomUUID()}`)
}
