# Serverless Wiki

Sample : https://popn-wiki.hyrorre.workers.dev/

## Features

- Markdown based syntax
- Auth
- Fast response
- Customizable

## Powered by

- [Nuxt](https://nuxt.com) : SSR/SSG Framework
- [@nuxtjs/mdc](https://nuxt.com/modules/mdc) : Markdown parser
- [nuxt-auth-utils](https://nuxt.com/modules/auth-utils) : Auth utils
- [NuxtHub](https://hub.nuxt.com) : DB, Blob, KV Wrapper
- [Cloudflare](https://www.cloudflare.com/) : Hosting, Edge Functions, DB, Blob, KV
- [Resend](https://resend.com/) : Email Service

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

## TODO

- [ ] feat(core): cache strategy (swr/isr)
- [ ] feat(test): test codes (bun test)
- [ ] feat(core): monaco-editor (vscode like)
- [ ] feat(core): toc component
- [ ] feat(ui): breadcrumb ui
- [ ] feat(core): user role (admin/editor/commenter/viewer)
