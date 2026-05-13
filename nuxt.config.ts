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
    '@nuxtjs/mdc',
    'nuxt-resend',
    '@nuxtjs/sitemap'
  ],
  site: {
    url: 'https://popn.wiki',
    name: 'ポップンミュージック上級攻略Wiki'
  },
  sitemap: {
    excludeAppSources: true,
    sources: ['/api/sitemap']
  },
  mdc: {
    remarkPlugins: {
      breaks: {
        src: 'remark-breaks'
      },
      remarkLegacyUrl: {
        src: '~/utils/remark-legacy-url'
      },
      tableMerge: {
        src: '~/utils/remark-table-merge'
      },
      tableColor: {
        src: '~/utils/remark-table-color'
      },
      definitionList: {
        src: '~/utils/remark-definition-list'
      }
    },
    rehypePlugins: {
      rehypeLegacyUrl: {
        src: '~/utils/rehype-legacy-url'
      },
      'rehype-external-links': {
        src: 'rehype-external-links',
        options: {
          target: '_blank',
          rel: ['noopener', 'noreferrer']
        }
      }
    }
  },
  icon: {
    customCollections: [
      {
        prefix: 'public',
        dir: './public'
      }
    ]
  },
  colorMode: {
    preference: 'light'
  },
  hub: {
    blob: true,
    cache: true,
    kv: true,
    db: {
      dialect: 'sqlite',
      casing: 'snake_case'
      // driver: 'd1-http',
      // connection: {
      //   accountId: process.env.NUXT_HUB_CLOUDFLARE_ACCOUNT_ID,
      //   databaseId: process.env.NUXT_HUB_CLOUDFLARE_DB_ID,
      //   token: process.env.NUXT_HUB_CLOUDFLARE_API_TOKEN
      // }
    }
  },
  runtimeConfig: {
    cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID || '',
    cloudflareCachePurgeToken: process.env.CLOUDFLARE_CACHE_PURGE_TOKEN || '',
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      maxAge: 60 * 60 * 24 * 180
    },
    public: {
      imageBasePath: process.env.NUXT_PUBLIC_IMAGE_BASE_PATH || '/api/image'
    }
  },
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'diff',
        'zod',
        'remark-breaks',
        'rehype-external-links',
        'remark-parse'
      ]
    },
    vue: {
      features: {
        // Options APIを無効化することでバンドルサイズを削減
        optionsAPI: false
      }
    }
  },
  nitro: {
    compatibilityDate: '2026-03-29',
    preset: 'cloudflare_module',
    sourceMap: false,
    experimental: {
      tasks: true
    },
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    }
  }
})
