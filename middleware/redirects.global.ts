import { parseURL } from 'ufo'
import { legacyImageRedirectPath } from '~/utils/legacyImage'

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

  // /score/start/*.{png,jpg,gif,webp} or /_media/score/start/*.* -> /api/image/*
  // Navigate with external: true to force a browser request and escape the SPA router
  const imagePath = legacyImageRedirectPath(path, parseURL(to.fullPath).search)
  if (imagePath) {
    return navigateTo(imagePath, {
      external: true,
      redirectCode: 301
    })
  }
})
