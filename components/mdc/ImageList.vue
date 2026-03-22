<script setup lang="ts">
type ImageItem = {
  name: string
  url: string
  created_at: string
}

const { data: images, status } = await useFetch<ImageItem[]>('/api/image')

const copiedIndex = ref<number | null>(null)

const copyMarkdown = async (image: ImageItem, index: number) => {
  const text = `![${image.name}](${image.url})`
  await navigator.clipboard.writeText(text)
  copiedIndex.value = index
  setTimeout(() => { copiedIndex.value = null }, 2000)
}
</script>

<template>
  <div class="my-3">
    <p v-if="status === 'pending'" class="text-muted">読み込み中...</p>
    <p v-else-if="!images?.length" class="text-muted">画像がありません。</p>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      <div
        v-for="(image, index) in images"
        :key="image.name"
        class="border rounded p-2 flex flex-col gap-2"
      >
        <img
          :src="image.url"
          :alt="image.name"
          class="w-full h-24 object-contain rounded bg-gray-50 dark:bg-gray-900"
        />
        <p class="text-xs truncate" :title="image.name">{{ image.name }}</p>
        <button
          class="border px-2 py-1 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          @click="copyMarkdown(image, index)"
        >
          {{ copiedIndex === index ? 'コピー済み' : 'Markdownをコピー' }}
        </button>
      </div>
    </div>
  </div>
</template>
