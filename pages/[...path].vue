<script setup lang="ts">
const route = useRoute()

useHead({
  titleTemplate: '%s'
})

const { data: page } = await useFetch('/api/page', {
  query: { path: route.params.path || '/' }
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
