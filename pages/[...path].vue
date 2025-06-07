<script setup lang="ts">
const route = useRoute()

useHead({
  titleTemplate: '%s'
})

// const { data: page } = await useFetch('/api/page', {
//   query: { path: route.params.path || '/' }
// })

const { data: page } = await useAsyncData(route.path, () => {
  return queryCollection('content').path(route.path).first()
})
</script>

<template>
  <Header />
  <u-container class="flex">
    <Sidebar class="border-r border-(--ui-border) max-w-[200px]" />
    <main>
      <ContentRenderer v-if="page" :value="page.body" class="content" />
    </main>
  </u-container>
  <Footer />
</template>
