<script setup lang="ts">
const { data: config } = await useFetch('/api/config')
useHead({
  htmlAttrs: {
    lang: config.value?.lang || ''
  },
  title: config.value?.title || '',
  titleTemplate: '%s - ' + (config.value?.title || ''),
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
