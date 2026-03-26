// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: ['~/app.css'],
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@nuxtjs/i18n',
    '@nuxtjs/mdc',
    '@nuxt/scripts',
    '@nuxthub/core'
  ],
  mdc: {
    remarkPlugins: {
      breaks: {
        src: 'remark-breaks'
      },
      tableMerge: {
        src: '~/utils/remark-table-merge'
      },
      tableColor: {
        src: '~/utils/remark-table-color'
      }
    },
    rehypePlugins: {
      'rehype-external-links': {
        src: 'rehype-external-links',
        options: {
          target: '_blank',
          rel: ['noopener', 'noreferrer']
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
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    redirectOptions: {
      login: '/signin',
      callback: '/',
      include: ['/profile'],
      exclude: []
    }
  },
  hub: {
    blob: {
      driver: 'cloudflare-r2',
      bucketName: process.env.NUXT_HUB_CLOUDFLARE_BLOB_BUCKET!,
      binding: process.env.NUXT_HUB_CLOUDFLARE_BLOB_BINDING!
    },
    db: {
      dialect: 'sqlite',
      driver: 'd1-http',
      casing: 'snake_case'
    }
  },
  router: {
    options: {
      scrollBehaviorType: 'smooth'
    }
  },
  runtimeConfig: {
    public: {
      googleTagManagerId: process.env.NUXT_PUBLIC_GTAG_ID,
      googleAdsenseId: process.env.NUXT_PUBLIC_GOOGLE_ADSENSE_ID
    }
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit']
    }
  }
})
