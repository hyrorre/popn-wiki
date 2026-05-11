<script setup lang="ts">
const { app } = useAppConfig()

useHead({
  htmlAttrs: {
    lang: app.lang
  },
  title: app.title,
  titleTemplate: '%s - ' + app.title,
  meta: [
    { name: 'description', content: app.description },
    { property: 'og:site_name', content: app.title },
    { property: 'og:type', content: app.type },
    { property: 'og:title', content: app.title },
    { property: 'og:description', content: app.description },
    { property: 'og:url', content: app.url },
    { property: 'og:image', content: app.image },
    { name: 'twitter:card', content: app.card },
    { name: 'twitter:site', content: app.twitter },
    { name: 'twitter:creator', content: app.twitter },
    { name: 'apple-mobile-web-app-title', content: 'ポップンWiki' }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'shortcut icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/site.webmanifest' }
  ]
})
</script>

<template>
  <u-app :locale="app.locale">
    <NuxtPage />
  </u-app>
</template>
