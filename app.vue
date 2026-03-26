<script setup lang="ts">
const config = useRuntimeConfig()
const { app } = useAppConfig()

useHead({
  htmlAttrs: {
    lang: app.lang
  },
  title: app.title,
  titleTemplate: '%s - ' + app.title,
    meta: [
    // TODO: set meta tags
    // { property: 'og:type', content: 'website' },
    // { property: 'og:site_name', content: '<site_name>' },
    // { property: 'og:image', content: '<image>' }
  ]
})

if (config.public.googleTagManagerId) {
  useScriptGoogleTagManager({
    id: config.public.googleTagManagerId
  })
}

if (config.public.googleAdsenseId) {
  useScriptGoogleAdsense({
    client: config.public.googleAdsenseId
  })
}
</script>

<template>
  <NuxtPage />
</template>
