// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: ['~/app.css'],
  modules: ['@nuxt/content', '@nuxt/eslint', '@nuxt/ui', '@nuxtjs/supabase', '@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'ja', name: '日本語', file: 'ja.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ],
    defaultLocale: 'ja'
  },
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
      include: [],
      exclude: ['/forgot', '/reset', '/signup']
    }
  }
})
