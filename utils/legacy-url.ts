export const LEGACY_HREF_FALLBACK = '#legacy-url'

export function isLegacyPercentEncodedUrl(value: string) {
  if (!value.includes('%')) return false

  try {
    decodeURIComponent(value)
    return false
  } catch {
    return true
  }
}
