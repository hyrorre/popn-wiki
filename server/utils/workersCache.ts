import { setResponseHeader, type H3Event } from 'h3'

type WorkersCachePurgeOptions =
  | {
      tags?: string[]
      pathPrefixes?: string[]
      purgeEverything?: never
    }
  | {
      purgeEverything: true
      tags?: never
      pathPrefixes?: never
    }

type WorkersCachePurgeResult = {
  success?: boolean
  errors?: { message?: string }[]
}

type WorkersCacheSelectivePurgeOptions = {
  tags?: string[]
  pathPrefixes?: string[]
}

type WorkersCacheExecutionContext = {
  cache?: {
    purge: (options: WorkersCachePurgeOptions) => Promise<WorkersCachePurgeResult | undefined>
  }
}

const API_PAGE_TAG = 'popn-wiki:api:page'
const API_PAGE_LATEST_TAG_PREFIX = 'popn-wiki:api:page:latest:'
const API_PAGE_REVISION_TAG_PREFIX = 'popn-wiki:api:page:revision:'
const API_SITEMAP_TAG = 'popn-wiki:api:sitemap'
const API_RECENT_PAGES_TAG = 'popn-wiki:api:page:recent'
const API_COMMENT_LIST_TAG_PREFIX = 'popn-wiki:api:comment:list:'
const API_RECENT_COMMENTS_TAG = 'popn-wiki:api:comment:recent'
const PAGE_MUTATION_PATH_PREFIXES = ['/api/page', '/api/sitemap', '/api/comment/recent']
const COMMENT_MUTATION_PATH_PREFIXES = ['/api/comment']

export function setWorkersCacheTags(event: H3Event, tags: string[]) {
  const normalizedTags = normalizeWorkersCacheTags(tags)
  if (normalizedTags.length === 0) {
    return
  }

  setResponseHeader(event, 'Cache-Tag', normalizedTags.join(','))
}

export async function purgeWorkersCacheByTags(event: H3Event, tags: string[]): Promise<boolean> {
  return purgeWorkersCache(event, { tags })
}

export async function purgeWorkersCache(event: H3Event, options: WorkersCacheSelectivePurgeOptions): Promise<boolean> {
  const normalizedOptions = normalizeWorkersCachePurgeOptions(options)
  if (!normalizedOptions.tags?.length && !normalizedOptions.pathPrefixes?.length) {
    return true
  }

  const cache = await getWorkersCache(event)
  if (!cache) {
    console.warn('[WorkersCachePurge] Purge API is unavailable in both cloudflare:workers and the execution context.')
    return false
  }

  try {
    const result = await cache.purge(normalizedOptions)
    if (result?.success === false) {
      console.warn(`[WorkersCachePurge] Purge returned success=false: ${formatPurgeErrors(result.errors)}`)
      return false
    }

    return true
  } catch (error) {
    console.warn(`[WorkersCachePurge] Failed to purge Workers Cache: ${getErrorMessage(error)}`)
    return false
  }
}

export function getPageResponseWorkersCacheTags(path: string, revision?: number) {
  const pathKey = getPathTagKey(path)

  if (revision !== undefined) {
    return [API_PAGE_TAG, `${API_PAGE_REVISION_TAG_PREFIX}${pathKey}:${revision}`]
  }

  return [API_PAGE_TAG, getLatestPageWorkersCacheTag(path)]
}

export function getSitemapWorkersCacheTags() {
  return [API_SITEMAP_TAG]
}

export function getPageMutationWorkersCacheTags(path: string) {
  return [getLatestPageWorkersCacheTag(path), API_SITEMAP_TAG, API_RECENT_PAGES_TAG, API_RECENT_COMMENTS_TAG]
}

export function getPageMutationWorkersCachePurgeOptions(path: string) {
  return {
    tags: getPageMutationWorkersCacheTags(path),
    pathPrefixes: PAGE_MUTATION_PATH_PREFIXES
  }
}

export function getRecentPagesWorkersCacheTags() {
  return [API_RECENT_PAGES_TAG]
}

export function getCommentListWorkersCacheTags(path: string) {
  return [`${API_COMMENT_LIST_TAG_PREFIX}${getPathTagKey(path)}`]
}

export function getRecentCommentsWorkersCacheTags() {
  return [API_RECENT_COMMENTS_TAG]
}

export function getCommentMutationWorkersCacheTags(path: string) {
  return [`${API_COMMENT_LIST_TAG_PREFIX}${getPathTagKey(path)}`, API_RECENT_COMMENTS_TAG]
}

export function getCommentMutationWorkersCachePurgeOptions(paths: string | string[]) {
  const normalizedPaths = Array.isArray(paths) ? [...new Set(paths)] : [paths]

  return {
    tags: [...new Set(normalizedPaths.flatMap((path) => getCommentMutationWorkersCacheTags(path)))],
    pathPrefixes: COMMENT_MUTATION_PATH_PREFIXES
  }
}

function getLatestPageWorkersCacheTag(path: string) {
  return `${API_PAGE_LATEST_TAG_PREFIX}${getPathTagKey(path)}`
}

function getPathTagKey(path: string) {
  return fnv1a32(path)
}

function fnv1a32(value: string) {
  let hash = 0x811c9dc5
  const bytes = new TextEncoder().encode(value)

  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

function normalizeWorkersCacheTags(tags: string[]) {
  return [...new Set(tags.filter(isValidWorkersCacheTag))]
}

function normalizeWorkersCachePurgeOptions(options: WorkersCacheSelectivePurgeOptions) {
  const tags = normalizeWorkersCacheTags(options.tags ?? [])
  const pathPrefixes = [...new Set((options.pathPrefixes ?? []).filter(isValidWorkersCachePathPrefix))]

  return {
    ...(tags.length > 0 ? { tags } : {}),
    ...(pathPrefixes.length > 0 ? { pathPrefixes } : {})
  }
}

function isValidWorkersCacheTag(tag: string) {
  return /^[!-~]{1,1024}$/.test(tag)
}

function isValidWorkersCachePathPrefix(pathPrefix: string) {
  return pathPrefix.startsWith('/') && !/[?#]/.test(pathPrefix)
}

function getWorkersCacheExecutionContext(event: H3Event) {
  return (event.context.cloudflare as { context?: WorkersCacheExecutionContext } | undefined)?.context
}

async function getWorkersCache(event: H3Event) {
  try {
    const workersModule = (await import('cloudflare:workers')) as unknown as { cache?: WorkersCacheExecutionContext['cache'] }
    if (workersModule.cache?.purge) {
      return workersModule.cache
    }
  } catch {
    // Local runtimes may not expose the newly released module API yet.
  }

  return getWorkersCacheExecutionContext(event)?.cache
}

function formatPurgeErrors(errors: WorkersCachePurgeResult['errors']) {
  return errors?.map((error) => error.message).filter(Boolean).join('; ') || 'Unknown error'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
