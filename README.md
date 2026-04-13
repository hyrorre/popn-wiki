# Serverless Wiki

Sample : https://popn-wiki.hyrorre.workers.dev/

(WIP)

## TODO

- [x] fix: external link
- [x] page create/delete
- [x] image upload
- [x] recent edit/comment
- [x] fix: converting link (pagename)
- [x] fix: google-analytics
- [x] table sort
- [x] convert comments
- [x] comment paging
- [x] edit page layout (vertical/horizontal)
- [x] sidebar layout
- [x] revision view/diff
- [x] definition list
- [x] auto link label
- [x] user email confirmation
- [x] staging
- [x] fix: seeding comments
- [x] NOTOC
- [x] NOCACHE
- [x] display page title (RecentEdits/RecentComments)
- [x] fix: nested span tag (MDC style)
- [ ] annotation (注釈)
- [ ] feat: migrate images
- [ ] TOC
- [ ] feat: monaco-editor (vscode like)
- [ ] media file redirect
- [ ] fix: sort table
- [ ] breadcrumb
- [ ] user role (admin/editor/commenter/viewer)
- [ ] cache strategy (swr/isr)
- [ ] test codes (bun test)

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
