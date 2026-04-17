<script setup lang="ts">
type ImageItem = {
  name: string
  url: string
  created_at: string
}

type ImageResponse = {
  images: ImageItem[]
  cursor?: string
  hasMore: boolean
}

const images = ref<ImageItem[]>([])
const cursor = ref<string | undefined>()
const hasMore = ref(false)
const loading = ref(false)

const loadImages = async (nextCursor?: string) => {
  loading.value = true
  try {
    const data = await $fetch<ImageResponse>('/api/image', {
      query: { cursor: nextCursor, limit: 1000 }
    })
    if (nextCursor) {
      images.value.push(...data.images)
    } else {
      images.value = data.images
    }
    cursor.value = data.cursor
    hasMore.value = data.hasMore
  } finally {
    loading.value = false
  }
}

await loadImages()
</script>

<template>
  <div class="my-3">
    <div v-if="!images.length && loading" class="text-muted">読み込み中...</div>
    <p v-else-if="!images.length" class="text-muted">画像がありません。</p>
    <div v-else class="">
      <ul class="">
        <li v-for="image in images" :key="image.name" class="">
          <u-link :to="image.url" external>{{ image.name }}</u-link>
        </li>
      </ul>
      <div v-if="hasMore" class="mt-4">
        <button
          class="border px-4 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
          :disabled="loading"
          @click="loadImages(cursor)"
        >
          {{ loading ? '読み込み中...' : 'さらに読み込む' }}
        </button>
      </div>
    </div>
  </div>
</template>
