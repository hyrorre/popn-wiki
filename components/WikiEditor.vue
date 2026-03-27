<script setup lang="ts">
import type { Page } from '~/types'

const props = defineProps<{
  path: string
  initialBody: string
  baseRevision: number
}>()

const emit = defineEmits<{
  saved: [page: Page]
  cancel: []
  conflict: [latestRevision: number]
}>()

const body = ref(props.initialBody)
const message = ref('')
const errorMessage = ref('')
const saving = ref(false)
const loadingHistory = ref(false)
const restoring = ref<number | null>(null)
const revisions = ref<Page[]>([])

watch(
  () => [props.initialBody, props.baseRevision] as const,
  ([nextBody]) => {
    body.value = nextBody
    message.value = ''
    errorMessage.value = ''
  }
)

const loadHistory = async () => {
  loadingHistory.value = true
  try {
    revisions.value = await $fetch<Page[]>('/api/page/history', {
      query: { path: props.path }
    })
  } catch {
    errorMessage.value = '履歴の読み込みに失敗しました。'
  } finally {
    loadingHistory.value = false
  }
}

const save = async () => {
  saving.value = true
  errorMessage.value = ''
  try {
    const saved = await $fetch<Page>('/api/page', {
      method: 'PUT',
      body: {
        path: props.path,
        body: body.value,
        baseRevision: props.baseRevision,
        message: message.value
      }
    })
    emit('saved', saved)
  } catch (error: unknown) {
    const err = error as { statusCode?: number; data?: { latestRevision?: number } }
    if (err.statusCode === 409) {
      emit('conflict', err.data?.latestRevision ?? props.baseRevision)
    } else {
      errorMessage.value = '保存に失敗しました。'
    }
  } finally {
    saving.value = false
  }
}

const restore = async (revision: number) => {
  restoring.value = revision
  errorMessage.value = ''
  try {
    const saved = await $fetch<Page>('/api/page/restore', {
      method: 'POST',
      body: {
        path: props.path,
        targetRevision: revision
      }
    })
    emit('saved', saved)
  } catch {
    errorMessage.value = '差し戻しに失敗しました。'
  } finally {
    restoring.value = null
  }
}

await loadHistory()
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex gap-2 items-center">
      <button class="border px-3 py-1 rounded" :disabled="saving" @click="save">
        {{ saving ? '保存中...' : '保存' }}
      </button>
      <button class="border px-3 py-1 rounded" :disabled="saving" @click="$emit('cancel')">キャンセル</button>
      <input
        v-model="message"
        type="text"
        class="border rounded px-2 py-1 flex-1"
        placeholder="変更メッセージ（任意）"
      />
    </div>

    <p v-if="errorMessage" class="text-red-600">{{ errorMessage }}</p>

    <div class="grid grid-cols-2 gap-3 min-h-[520px]">
      <textarea v-model="body" class="border rounded p-3 w-full h-full font-mono" />
      <article class="border rounded p-3 overflow-auto">
        <MDC :value="body" class="content" />
      </article>
    </div>

    <section class="border rounded p-3">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-bold">履歴</h3>
        <button class="border px-2 py-1 rounded" :disabled="loadingHistory" @click="loadHistory">
          {{ loadingHistory ? '更新中...' : '再読み込み' }}
        </button>
      </div>

      <ul class="space-y-2 max-h-72 overflow-auto">
        <li v-for="item in revisions" :key="`${item.path}:${item.revision}`" class="border rounded p-2">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">r{{ item.revision }}</p>
              <p class="text-sm text-muted">{{ item.updatedAt }} / {{ item.updatedBy }}</p>
              <p v-if="item.message" class="text-sm">{{ item.message }}</p>
            </div>
            <button class="border px-2 py-1 rounded" :disabled="restoring !== null" @click="restore(item.revision)">
              {{ restoring === item.revision ? '実行中...' : 'この版に差し戻す' }}
            </button>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>
