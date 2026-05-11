# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Nuxt 4 / Vue 3 wiki application for ポップンミュージック上級攻略Wiki (popn.wiki). Deployed to Cloudflare Workers (module preset) with Cloudflare D1 (SQLite), R2 (Blob for images), and KV (cache). Package manager is Bun.

## Commands

```bash
bun install          # install dependencies
bun run dev          # dev server at http://localhost:3000
bun run build        # production build
bun run preview      # preview production build locally
bun run tsc          # type-check (vue-tsc --noEmit)
bunx eslint .        # lint without auto-fix
bun run lint         # lint with auto-fix (eslint . --fix)
bun run format       # format (prettier . --write)
bun test             # run all tests
bun test test/foo.test.ts  # run a single test file
bun run db:generate  # generate Drizzle migration after schema changes
bun run db:migrate   # apply migrations
bun run db:push      # push schema to DB directly (dev only)
bun run db:studio    # open Drizzle Studio
```

After changing TypeScript/server logic: run `bun run tsc`. After changing DB schema: run `bun run db:generate` and review the diff. After finishing: verify `git status --short` shows only intended changes.

`bun run lint` and `bun run format` **rewrite files in place**. Use `bunx eslint .` to check without modifying.

Drizzle/Cloudflare D1 commands require `NUXT_HUB_CLOUDFLARE_ACCOUNT_ID`, `NUXT_HUB_CLOUDFLARE_DATABASE_ID`, and `NUXT_HUB_CLOUDFLARE_API_TOKEN` env vars. Tests require the `TEST_*` vars in `.env.example`.

## Architecture

### Data model

`server/db/schema.ts` is the source of truth. Key tables:

- **`pages`** — composite primary key `(path, revision)`. Latest page = highest revision. Soft-deleted pages have `body = ''`. The pre-rendered MDC AST is stored in `bodyAst` (JSON string) alongside raw `body` markdown to avoid re-parsing on every request.
- **`comments`** — threaded via `replyTo` (self-referential integer). Soft-deleted via `deletedAt`.
- **`users`** — email/password auth (bcrypt) with optional Google OAuth. `confirmed` flag requires email verification before login.
- **`tokens`** — short-lived tokens for email verification and password reset (24h TTL).

### Server (Nitro / Cloudflare Workers)

`server/api/` handlers follow Nuxt file-based routing (e.g. `page.get.ts` → `GET /api/page`). DB access uses `db()` from `@nuxthub/db` (Drizzle ORM over Cloudflare D1). Auth state comes from `useUserSession()` (nuxt-auth-utils sessions stored in encrypted cookies).

Page cache lives in NuxtHub KV (`server/utils/pageCache.ts`) and must be invalidated on write — see `invalidateLatestPageCache()`. Input validation uses Zod schemas from `shared/zod/`.

### Client (Nuxt / Vue 3)

`pages/[...path].vue` is the catch-all wiki page renderer. It fetches the page API including soft-deleted pages (`includeDeleted=true`) and renders the pre-parsed AST via MDC. Discussion (comments) is shown only when frontmatter `discussion: true` is present in the page's MDC AST data.

Composables:
- `usePageActions` — shared reactive state for sidebar open/close, current revision, edit permission
- `useNavigation` — sidebar nav links

Options API is disabled in Vite config to reduce bundle size — use Composition API only.

### Markdown pipeline

Custom remark/rehype plugins live in `utils/`:
- `remark-legacy-url` / `rehype-legacy-url` — handles old percent-encoded URLs from the legacy PHP wiki
- `remark-table-merge` — cell merging syntax in tables
- `remark-table-color` — colored cell syntax in tables
- `remark-definition-list` — `dl/dt/dd` syntax

MDC components (`components/mdc/`) are available inside wiki page content.

### Auth flow

`server/api/auth/` handles signup (email verification required), signin, Google OAuth, password reset (Resend email), and signout. Password migration from legacy MD5crypt to bcrypt is handled in `server/utils/auth.ts`.

## Key files

| File | Purpose |
|------|---------|
| `nuxt.config.ts` | Modules, MDC plugins, NuxtHub/Cloudflare config |
| `app.config.ts` | Site metadata, Japanese locale (`ja`/`ja-JP`), date format |
| `server/db/schema.ts` | DB schema (single source of truth) |
| `shared/zod/` | Validation schemas shared between client and server |
| `shared/types/index.ts` | Shared TypeScript types (`Page`, `Comment`, `Profile`, etc.) |
| `wrangler.jsonc` | Cloudflare bindings (D1, R2, KV) |
| `.env.example` | Required environment variables (never read/commit `.env`) |

## Environment

Do not read, display, or commit `.env`. When adding new env vars, add the key (without value) to `.env.example`. UI copy and locale settings must match the Japanese site — follow `app.config.ts` `ja` locale and existing copy patterns.
