<script setup lang="ts">
// const { data: config } = await useFetch('/api/config')
const route = useRoute()

useHead({
  titleTemplate: '%s'
})

const { data: page } = await useFetch('/api/page', {
  query: { path: route.params.path || '/' }
})
</script>

<template>
  <u-container>
    <MDC v-if="page" :value="page.body" class="content" />
  </u-container>
</template>
