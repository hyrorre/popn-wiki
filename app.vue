<script setup lang="ts">
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
</script>

<template>
  <NuxtPage />
</template>
