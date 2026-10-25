import { legacyImageRedirectPath } from '~/utils/legacyImage'

export default defineEventHandler((event) => {
  const { pathname, search } = getRequestURL(event)

  // 旧画像URLを、ファイル名とクエリを保持して画像APIへ転送する。
  const target = legacyImageRedirectPath(pathname, search)
  if (target) {
    return sendRedirect(event, target, 301)
  }
})
