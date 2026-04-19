export default defineNuxtRouteMiddleware((to) => {
  const path = to.path

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
