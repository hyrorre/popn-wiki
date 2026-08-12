import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    name: 'nuxt',
    include: ['test/nuxt/**/*.test.ts'],
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
        overrides: {
          devtools: { enabled: false },
          nitro: { preset: 'node-server' },
          hub: {
            blob: false,
            cache: false,
            db: false,
            kv: false
          },
          fonts: {
            provider: 'local',
            providers: {
              adobe: false,
              bunny: false,
              fontshare: false,
              fontsource: false,
              google: false,
              googleicons: false,
              npm: false
            }
          },
          icon: {
            serverBundle: { collections: ['lucide'] },
            clientBundle: { sizeLimitKb: 0 }
          }
        }
      }
    }
  }
})
