export default defineEventHandler((event) => {
  const { pathname, search } = getRequestURL(event)

  // 旧画像URLを、ファイル名とクエリを保持して画像APIへ転送する。
  if (
    (pathname.startsWith('/score/start/') || pathname.startsWith('/_media/score/start/')) &&
    /\.(png|jpe?g|gif|webp)$/i.test(pathname)
  ) {
    const segments = pathname.split('/')
    const filename = segments[segments.length - 1]

    if (filename) {
      return sendRedirect(event, `/api/image/${filename}${search}`, 301)
    }
  }
})
