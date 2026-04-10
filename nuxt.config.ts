// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: ['~/app.css'],
  modules: ['@nuxt/content', '@nuxt/eslint', '@nuxt/ui', 'nuxt-studio'],
  content: {
    build: {
      markdown: {
        remarkPlugins: {
          tableMerge: {
            src: '~/utils/remark-table-merge'
          },
          tableColor: {
            src: '~/utils/remark-table-color'
          },
          definitionList: {
            src: '~/utils/remark-definition-list'
          }
        }
      }
    }
  },
  studio: {
    dev: false,
    i18n: {
      defaultLocale: 'ja'
    },
    repository: {
      provider: 'github',
      owner: 'hyrorre',
      repo: 'popn-wiki',
      branch: 'main'
    }
  },
  nitro: {
    prerender: {
      routes: ['/'],
      crawlLinks: true,
      failOnError: false
    }
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit']
    }
  }
})
