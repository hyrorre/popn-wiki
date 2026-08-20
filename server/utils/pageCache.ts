const LATEST_PAGE_VERSION_PREFIX = 'pages:latest-version:'

export function getLatestPageCacheKey(path: string, version: string) {
  return `pages:latest:${encodeURIComponent(path)}:${version}`
}

export function getRevisionPageCacheKey(path: string, revision: number) {
  return `pages:revision:${encodeURIComponent(path)}:${revision}`
}

export async function getLatestPageCacheVersion(path: string) {
  return (await useStorage('cache').getItem<string>(getLatestPageVersionKey(path))) ?? '0'
}

export async function invalidateLatestPageCache(path: string) {
  await useStorage('cache').setItem(getLatestPageVersionKey(path), `${Date.now()}:${crypto.randomUUID()}`)
}

function getLatestPageVersionKey(path: string) {
  return `${LATEST_PAGE_VERSION_PREFIX}${encodeURIComponent(path)}`
}
