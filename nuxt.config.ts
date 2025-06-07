// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: ['~/app.css'],
  modules: ['@nuxt/content', '@nuxt/eslint', '@nuxt/ui', '@nuxtjs/supabase'],
  imports: {
    dirs: ['types/**']
  },
  icon: {
    customCollections: [
      {
        prefix: 'public',
        dir: './public'
      }
    ]
  },
  supabase: {
    redirectOptions: {
      login: '/signin',
      callback: '/',
      include: []
    }
  }
})
