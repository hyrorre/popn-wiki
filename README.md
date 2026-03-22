# Serverless Wiki

Sample : https://popnwiki.hyrorre.workers.dev/

(WIP)

## TODO
- [x] Fix: external link
- [x] page create/delete
- [ ] image upload
- [ ] Fix: converting link (pagename)
- [ ] table sort
- [ ] convert comments
- [ ] comment paging
- [ ] recent edit/comment
- [ ] NOTOC/TOC
- [ ] NOCACHE
- [ ] edit page layout (vertical/horizontal)
- [ ] sidebar layout
- [ ] definition list

## Feature
- Markdown based syntax
- Auth
- Fast response
- Customizable

## Powered by
- [Nuxt](https://nuxt.com) : SSR Framework
- [@nuxtjs/mdc](https://nuxt.com/modules/mdc) : Markdown parser
- [Supabase](https://supabase.com) : DB, Auth, Storage
- [Cloudflare Workers](https://www.cloudflare.com/developer-platform/products/workers/) : Hosting, Edge Functions

## Setup

Make sure to install dependencies:

```bash
# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# bun
bun run dev
```

## Production

Build the application for production:

```bash
# bun
bun run build
```

Locally preview production build:

```bash
# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
