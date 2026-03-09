// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: ['~/app.css'],
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/supabase', '@nuxtjs/i18n', '@nuxtjs/mdc'],
  mdc: {
    remarkPlugins: {
      dokuwikiLinks: {
        src: '~/utils/remark-dokuwiki-links',
        options: {
          // DokuWiki の内部リンク [[page]] をどのパスに飛ばすか
          // 例: /wiki/page にしたければ '/wiki/' に変更
          basePath: '/'
        }
      }
    }
  },
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
