const COMMENT_CACHE_GROUP = 'comments'
const COMMENT_LIST_VERSION_NAME = 'version'

export function getCommentListCacheRawKey(path: string, page: number, limit: number, version: string) {
  return `path=${encodeURIComponent(path)}:page=${page}:limit=${limit}:version=${version}`
}

export async function getCommentListCacheVersion(path: string) {
  return (await useStorage('cache').getItem<string>(getCommentListVersionKey(path))) || '0'
}

export async function invalidateCommentListCache(path: string) {
  await useStorage('cache').setItem(getCommentListVersionKey(path), `${Date.now()}:${crypto.randomUUID()}`)
}

function getCommentListVersionKey(path: string) {
  return [COMMENT_CACHE_GROUP, COMMENT_LIST_VERSION_NAME, encodeURIComponent(path)].join(':')
}
