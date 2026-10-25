const LEGACY_IMAGE_PREFIXES = ['/score/start/', '/_media/score/start/']
const LEGACY_IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp)$/i

// 旧画像URLの転送先。サーバーの直接アクセスとクライアントのリンク遷移で同じ判定を使う。
// pathname はパーセントエンコードのまま受け取り、ファイル名とクエリを保持する。
export function legacyImageRedirectPath(pathname: string, search = '') {
  if (!LEGACY_IMAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || !LEGACY_IMAGE_EXTENSION.test(pathname)) {
    return null
  }

  const filename = pathname.split('/').pop()
  return filename ? `/api/image/${filename}${search}` : null
}
