<script setup lang="ts">
const route = useRoute()

useHead({
  titleTemplate: '%s'
})

// Nuxt の catch-all は `route.params.path` が `string | string[]` になり得ます。
// `/aaa/bbb` -> `['aaa', 'bbb']` となるため、API には `aaa/bbb` を渡します。
const requestedPath = Array.isArray(route.params.path) ? route.params.path.join('/') : route.params.path

const { data: page } = await useFetch('/api/page', {
  query: { path: requestedPath || '/' }
})
</script>

<template>
  <Header />
  <u-container class="flex">
    <Sidebar class="border-r border-default max-w-[200px]" />
    <main>
      <MDC v-if="page" :value="page.body" class="content" />
    </main>
  </u-container>
  <Footer />
</template>
