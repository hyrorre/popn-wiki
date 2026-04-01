<script setup lang="ts">
const { data: page } = await useFetch('/api/page', {
  query: { path: 'sidebar' }
})
</script>

<template>
  <aside class="py-4 px-2 overflow-y-auto max-h-full">
    <MDC v-if="page" :value="page.body" class="content" />
  </aside>
</template>
