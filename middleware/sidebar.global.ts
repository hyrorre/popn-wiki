export default defineNuxtRouteMiddleware((to, from) => {
  if (to.path !== from.path) {
    const { setSidebarOpen } = usePageActions()
    setSidebarOpen(false)
  }
})
