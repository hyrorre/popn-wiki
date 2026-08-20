import { sanitizeLinkTarget } from './markdown-security'

export const LEGACY_HREF_FALLBACK = '#legacy-url'

export function isLegacyPercentEncodedUrl(value: string) {
  const safeUrl = sanitizeLinkTarget(value)
  if (!safeUrl || !/^https?:\/\//i.test(safeUrl) || !safeUrl.includes('%')) return false

  try {
    decodeURIComponent(safeUrl)
    return false
  } catch {
    return true
  }
}
