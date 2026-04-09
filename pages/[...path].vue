<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(() => queryCollection('content').path(route.path).first())

if (!data.value) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, 404)
  }
}

useSeoMeta({
  title: data.value?.title || 'ページが見つかりません',
  description: data.value?.description
})
</script>

<template>
  <ContentRenderer v-if="data" :value="data" />
  <div v-else>ページが見つかりません</div>
</template>
