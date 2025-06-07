<script setup lang="ts">
// const { data: page } = await useFetch('/api/page', {
//   query: { path: '/sidebar' }
// })

const { data: page } = await useAsyncData('sidebar', () => {
  return queryCollection('content').path('/sidebar').first()
})
</script>

<template>
  <aside>
    <ContentRenderer v-if="page" :value="page.body" class="content" />
  </aside>
</template>
