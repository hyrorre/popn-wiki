# Serverless Wiki

Sample : https://popnwiki.hyrorre.workers.dev/

(WIP)

## TODO

- [x] Fix: external link
- [x] page create/delete
- [x] image upload
- [x] recent edit/comment
- [x] Fix: converting link (pagename)
- [x] Fix: google-analytics
- [x] table sort
- [x] convert comments
- [ ] comment paging
- [ ] NOTOC/TOC
- [ ] NOCACHE
- [ ] edit page layout (vertical/horizontal)
- [ ] sidebar layout
- [ ] definition list
- [ ] media file redirect

## Feature

- Markdown based syntax
- Auth
- Fast response
- Customizable

## Powered by

- [Nuxt](https://nuxt.com) : SSR Framework
- [@nuxtjs/mdc](https://nuxt.com/modules/mdc) : Markdown parser
- [NuxtHub](https://hub.nuxt.com) : DB (D1), Blob (R2)
- [Cloudflare](https://www.cloudflare.com/) : Hosting, Edge Functions

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
