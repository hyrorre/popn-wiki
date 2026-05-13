export function getLatestPageCacheKey(path: string) {
  return `pages:latest:${encodeURIComponent(path)}`
}

export function getRevisionPageCacheKey(path: string, revision: number) {
  return `pages:revision:${encodeURIComponent(path)}:${revision}`
}

export async function invalidateLatestPageCache(path: string) {
  await useStorage('cache').removeItem(getLatestPageCacheKey(path))
}
