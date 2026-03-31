<script setup lang="ts">
type ImageItem = {
  name: string
  url: string
  created_at: string
}

const { data: images, status } = await useFetch<ImageItem[]>('/api/image')
</script>

<template>
  <div class="my-3">
    <p v-if="status === 'pending'" class="text-muted">読み込み中...</p>
    <p v-else-if="!images?.length" class="text-muted">画像がありません。</p>
    <div v-else class="">
      <ul class="">
        <li v-for="image in images" :key="image.name" class="">
          <u-link :to="image.url" external>{{ image.name }}</u-link>
        </li>
      </ul>
    </div>
  </div>
</template>
