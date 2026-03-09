<script setup lang="ts">
const { data: page } = await useFetch('/api/page', {
  query: { path: '/sidebar' }
})
</script>

<template>
  <aside>
    <MDC v-if="page" :value="page.body" class="content" />
  </aside>
</template>
