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
  const imagePath = legacyImageRedirectPath(path, parseURL(to.fullPath).search)
  if (imagePath) {
    if (import.meta.server) {
      return navigateTo(imagePath, { external: true, redirectCode: 301 })
    }
    // navigateTo(external) stops the app scope before leaving, which drops head styles such as
    // nuxt-ui-colors. The browser's back/forward cache then restores that broken page, so leave
    // the current page intact and let the browser load the image.
    window.location.assign(imagePath)
    return abortNavigation()
  }
})
