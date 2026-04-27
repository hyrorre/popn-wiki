const COMMENT_CACHE_GROUP = 'comments'
const COMMENT_LIST_CACHE_NAME = 'list'

export function getCommentListCacheRawKey(path: string, page: number, limit: number) {
  return `path=${encodeURIComponent(path)}:page=${page}:limit=${limit}`
}

export async function invalidateCommentListCache(path: string) {
  const storage = useStorage('cache')
  const prefix = buildStorageKeyPrefix(COMMENT_LIST_CACHE_NAME, `path=${encodeURIComponent(path)}:`)
  const keys = await storage.getKeys(prefix)

  await Promise.all(keys.map((key) => storage.removeItem(key)))
}

function buildStorageKeyPrefix(name: string, rawKeyPrefix: string) {
  return [COMMENT_CACHE_GROUP, name, rawKeyPrefix].join(':')
}
