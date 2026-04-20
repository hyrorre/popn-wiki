export default defineNuxtRouteMiddleware((to) => {
  const path = to.path

  if (path === '/start') {
    return navigateTo('/', { redirectCode: 301 })
  }

  const commentArchiveMatch = path.match(/^\/その他\/comment\/(.+)_\/(\d+)$/)
  if (commentArchiveMatch) {
    return navigateTo(`/その他/comment/${commentArchiveMatch[1]}/${commentArchiveMatch[2]}`, { redirectCode: 301 })
  }

  const difficultyLevelMatch = path.match(/^\/難易度表\/lv\d+\/(.+)$/i)
  if (difficultyLevelMatch) {
    return navigateTo(`/難易度表/${difficultyLevelMatch[1]}`, { redirectCode: 301 })
  }

  // /score/start/*.png or /_media/score/start/*.png
  if ((path.startsWith('/score/start/') || path.startsWith('/_media/score/start/')) && path.endsWith('.png')) {
    const segments = path.split('/')
    const filename = segments[segments.length - 1]

    // Redirect /score/start/filename.png -> /api/image/filename.png
    // Navigate with external: true to force a browser request and escape the SPA router
    if (filename) {
      return navigateTo(`/api/image/${filename}`, {
        external: true,
        redirectCode: 301
      })
    }
  }
})
