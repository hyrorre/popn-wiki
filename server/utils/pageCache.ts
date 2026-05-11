const PAGE_CACHE_GROUP = 'pages'
const PAGE_LATEST_CACHE_NAME = 'latest'
// const PAGE_REVISION_CACHE_NAME = 'revision'

export function getLatestPageCacheRawKey(path: string) {
  return `latest:${path}`
}

export function getRevisionPageCacheRawKey(path: string, revision: number) {
  return `revision:${path}:${revision}`
}

export async function invalidateLatestPageCache(path: string) {
  await useStorage('cache').removeItem(buildStorageKey(PAGE_LATEST_CACHE_NAME, getLatestPageCacheRawKey(path)))
}

function buildStorageKey(name: string, rawKey: string) {
  return [PAGE_CACHE_GROUP, name, `${escapeKey(rawKey)}.json`].join(':')
}

function escapeKey(key: string) {
  return encodeURIComponent(String(key))
}
