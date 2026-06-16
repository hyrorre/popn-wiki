const SITE_ORIGIN = 'https://popn.wiki'

export function getWikiPagePurgeUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}/${path}`
}

export function getCommentMutationPurgeUrls(path: string): string[] {
  return [
    getWikiPagePurgeUrl(path),
    `${SITE_ORIGIN}/api/comment?path=${encodeURIComponent(path)}&page=1&limit=20`
  ]
}

export async function purgeCdnByUrls(urls: string[]): Promise<void> {
  const config = useRuntimeConfig()
  if (!config.cloudflareZoneId || !config.cloudflareCachePurgeToken) return

  await $fetch(`https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.cloudflareCachePurgeToken}` },
    body: { files: urls }
  })
}
