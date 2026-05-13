export async function purgeCdnByUrls(urls: string[]): Promise<void> {
  const config = useRuntimeConfig()
  if (!config.cloudflareZoneId || !config.cloudflareCachePurgeToken) return

  await $fetch(`https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.cloudflareCachePurgeToken}` },
    body: { files: urls }
  })
}
