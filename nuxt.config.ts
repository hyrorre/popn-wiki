// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: ['~/app.css'],
  modules: ['@nuxt/content', '@nuxt/eslint', '@nuxt/ui', 'nuxt-studio'],
  studio: {
    i18n: {
      defaultLocale: 'ja'
    },
    repository: {
      provider: 'github',
      owner: 'popn-wiki',
      repo: 'popn-wiki',
      branch: 'main'
    }
  },
  nitro: {
    prerender: {
      routes: ['/'],
      crawlLinks: true
    }
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit']
    }
  }
})
