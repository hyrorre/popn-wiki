<script setup lang="ts">
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const errorMessage = ref('')
const result = ref<{ url: string; filename: string } | null>(null)

const selectFile = () => {
  fileInput.value?.click()
}

const upload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true
  errorMessage.value = ''
  result.value = null

  const formData = new FormData()
  formData.append('file', file)

  try {
    const data = await $fetch<{ url: string; filename: string }>('/api/image', {
      method: 'POST',
      body: formData
    })
    result.value = data
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || 'アップロードに失敗しました。'
  } finally {
    uploading.value = false
    // inputをリセットして同一ファイルの再選択を可能にする
    if (fileInput.value) fileInput.value.value = ''
  }
}

const markdownText = computed(() => {
  if (!result.value) return ''
  return `![${result.value.filename}](${result.value.url})`
})

const copied = ref(false)

const copyMarkdown = async () => {
  if (!markdownText.value) return
  await navigator.clipboard.writeText(markdownText.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="border rounded p-4 my-3">
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      class="hidden"
      @change="upload"
    >

    <button
      class="border px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      :disabled="uploading"
      @click="selectFile"
    >
      {{ uploading ? 'アップロード中...' : '画像をアップロード' }}
    </button>

    <p v-if="errorMessage" class="text-red-600 mt-2 text-sm">{{ errorMessage }}</p>

    <div v-if="result" class="mt-3 flex items-center gap-2">
      <code class="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded flex-1 overflow-x-auto">{{ markdownText }}</code>
      <button
        class="border px-2 py-1 rounded text-sm whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        @click="copyMarkdown"
      >
        {{ copied ? 'コピー済み' : 'コピー' }}
      </button>
    </div>
  </div>
</template>
