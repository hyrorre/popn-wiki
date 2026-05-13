import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: {
    accountId: process.env.NUXT_HUB_CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.NUXT_HUB_CLOUDFLARE_DB_ID!,
    token: process.env.NUXT_HUB_CLOUDFLARE_API_TOKEN!
  },
  casing: 'snake_case'
})
