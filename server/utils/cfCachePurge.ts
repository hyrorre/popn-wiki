const SITE_ORIGIN = 'https://popn.wiki'

type CloudflarePurgeResponse = {
  success: boolean
  errors?: { message?: string }[]
}

export function getWikiPagePurgeUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_ORIGIN}/`

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/')
  return `${SITE_ORIGIN}/${encodedPath}`
}

export function getPageMutationPurgeUrls(path: string): string[] {
  return [
    getWikiPagePurgeUrl(path),
    `${SITE_ORIGIN}/api/page?path=${encodeURIComponent(path)}`,
    `${SITE_ORIGIN}/api/page/recent?limit=10&page=1&includeMinor=false`,
    `${SITE_ORIGIN}/api/page/recent?limit=10&page=1&includeMinor=true`,
    `${SITE_ORIGIN}/api/sitemap`,
    `${SITE_ORIGIN}/sitemap.xml`
  ]
}

export function getCommentMutationPurgeUrls(path: string): string[] {
  return [
    getWikiPagePurgeUrl(path),
    `${SITE_ORIGIN}/api/comment?path=${encodeURIComponent(path)}&page=1&limit=20`,
    `${SITE_ORIGIN}/api/comment/recent?limit=10&page=1`
  ]
}

export async function purgeCdnByUrls(urls: string[]): Promise<boolean> {
  const config = useRuntimeConfig()
  if (!config.cloudflareZoneId || !config.cloudflareCachePurgeToken) {
    console.warn('[CloudflareCachePurge] Missing NUXT_CLOUDFLARE_ZONE_ID or NUXT_CLOUDFLARE_CACHE_PURGE_TOKEN.')
    return false
  }

  try {
    const response = await $fetch<CloudflarePurgeResponse>(
      `https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/purge_cache`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.cloudflareCachePurgeToken}` },
        body: { files: urls }
      }
    )

    if (!response.success) {
      console.warn(`[CloudflareCachePurge] Purge API returned success=false: ${formatPurgeErrors(response.errors)}`)
      return false
    }

    return true
  } catch (error) {
    console.warn(`[CloudflareCachePurge] Failed to purge CDN cache: ${getErrorMessage(error)}`)
    return false
  }
}

function formatPurgeErrors(errors: CloudflarePurgeResponse['errors']) {
  return errors?.map((error) => error.message).filter(Boolean).join('; ') || 'Unknown error'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
