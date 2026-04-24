export default defineEventHandler((event) => {
  const path = event.path

  // /score/start/*.png or /_media/score/start/*.png
  if ((path.startsWith('/score/start/') || path.startsWith('/_media/score/start/')) && path.endsWith('.png')) {
    const segments = path.split('/')
    const filename = segments[segments.length - 1]

    // Redirect /score/start/filename.png -> /api/image/filename.png
    if (filename) {
      return sendRedirect(event, `/api/image/${filename}`, 301)
    }
  }
})
