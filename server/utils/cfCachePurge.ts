const SITE_HOST = 'popn.wiki'
const MAX_PREFIXES_PER_REQUEST = 30

const PAGE_MUTATION_PURGE_PREFIXES = [
  `${SITE_HOST}/api/page`,
  `${SITE_HOST}/api/comment/recent`,
  `${SITE_HOST}/api/sitemap`,
  `${SITE_HOST}/sitemap.xml`
]
const COMMENT_MUTATION_PURGE_PREFIXES = [`${SITE_HOST}/api/comment`]

type CloudflarePurgeResponse = {
  success: boolean
  errors?: { message?: string }[]
}

export function getPageMutationPurgePrefixes(): string[] {
  return [...PAGE_MUTATION_PURGE_PREFIXES]
}

export function getCommentMutationPurgePrefixes(): string[] {
  return [...COMMENT_MUTATION_PURGE_PREFIXES]
}

export async function purgeCdnByPrefixes(prefixes: string[]): Promise<boolean> {
  const normalizedPrefixes = [...new Set(prefixes.filter(isValidPurgePrefix))]
  if (normalizedPrefixes.length === 0) {
    return true
  }

  const config = useRuntimeConfig()
  if (!config.cloudflareZoneId || !config.cloudflareCachePurgeToken) {
    console.warn('[CloudflareCachePurge] Missing NUXT_CLOUDFLARE_ZONE_ID or NUXT_CLOUDFLARE_CACHE_PURGE_TOKEN.')
    return false
  }

  for (let index = 0; index < normalizedPrefixes.length; index += MAX_PREFIXES_PER_REQUEST) {
    const batch = normalizedPrefixes.slice(index, index + MAX_PREFIXES_PER_REQUEST)
    if (!(await purgeCdnPrefixBatch(config.cloudflareZoneId, config.cloudflareCachePurgeToken, batch))) {
      return false
    }
  }

  return true
}

async function purgeCdnPrefixBatch(zoneId: string, token: string, prefixes: string[]): Promise<boolean> {
  try {
    const response = await $fetch<CloudflarePurgeResponse>(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { prefixes }
      }
    )

    if (!response.success) {
      console.warn(`[CloudflareCachePurge] Prefix purge returned success=false: ${formatPurgeErrors(response.errors)}`)
      return false
    }

    return true
  } catch (error) {
    console.warn(`[CloudflareCachePurge] Failed to purge CDN cache by prefix: ${getErrorMessage(error)}`)
    return false
  }
}

function isValidPurgePrefix(prefix: string) {
  return prefix.startsWith(`${SITE_HOST}/`) && !/[?#]/.test(prefix)
}

function formatPurgeErrors(errors: CloudflarePurgeResponse['errors']) {
  return errors?.map((error) => error.message).filter(Boolean).join('; ') || 'Unknown error'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
