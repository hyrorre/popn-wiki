// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  css: ['~/app.css'],
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxthub/core',
    'nuxt-auth-utils',
    '@nuxtjs/i18n',
    '@nuxtjs/mdc',
    '@nuxt/scripts'
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
  hub: {
    blob: true,
    db: {
      dialect: 'sqlite',
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
  },
  nitro: {
    experimental: {
      tasks: true
    },
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
      wrangler: {
        d1_databases: [
          {
            binding: 'db',
            database_name: 'popn-wiki-db',
            database_id: process.env.NUXT_HUB_CLOUDFLARE_DATABASE_ID
          }
        ],
        r2_buckets: [
          {
            binding: 'bucket',
            bucket_name: process.env.NUXT_HUB_CLOUDFLARE_BLOB_BUCKET
          }
        ]
      }
    }
  }
})
