const RECENT_PAGES_VERSION_KEY = 'recent:pages:version'
export const RECENT_PAGES_TTL = 60 * 60

export function getRecentPagesCacheKey(
  params: { limit: number; page: number; includeMinor: boolean },
  version: string
) {
  return `recent:pages:v=${version}:limit=${params.limit}:page=${params.page}:minor=${params.includeMinor}`
}

export async function getRecentPagesCacheVersion(): Promise<string> {
  return (await useStorage('cache').getItem<string>(RECENT_PAGES_VERSION_KEY)) ?? '0'
}

export async function invalidateRecentPagesCache(): Promise<void> {
  await useStorage('cache').setItem(RECENT_PAGES_VERSION_KEY, `${Date.now()}:${crypto.randomUUID()}`)
}
