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

type LayoutMode = 'split' | 'stack'
const layoutMode = ref<LayoutMode>('split')

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
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-3 items-center justify-between bg-muted/30 p-2 rounded-lg border border-default">
      <div class="flex gap-2 items-center flex-1 min-w-[300px]">
        <u-button icon="i-heroicons-check" :loading="saving" @click="save">
          {{ saving ? '保存中...' : '保存' }}
        </u-button>
        <u-button variant="outline" color="neutral" :disabled="saving" @click="$emit('cancel')">キャンセル</u-button>
        <u-input
          v-model="message"
          type="text"
          class="flex-1"
          placeholder="変更メッセージ（任意）"
          icon="i-heroicons-chat-bubble-bottom-center-text"
        />
      </div>
    </div>

    <u-switch
      label="横並びレイアウトを有効にする"
      description="画面横幅が狭い場合は縦並びレイアウトになります"
      class="justify-start"
      :model-value="layoutMode === 'split'"
      @update:model-value="(val) => (layoutMode = val ? 'split' : 'stack')"
    />
    <p v-if="errorMessage" class="text-red-600 text-sm font-medium">{{ errorMessage }}</p>

    <div :class="['gap-4 min-h-[600px]', layoutMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-2' : 'flex flex-col']">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between px-1">
          <span class="text-xs font-bold text-muted uppercase">Editor</span>
          <span class="text-xs text-muted">{{ body.length }} characters</span>
        </div>
        <textarea
          v-model="body"
          class="border border-default rounded-lg p-4 w-full h-full min-h-[400px] font-mono text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          placeholder="Markdownを入力してください..."
        />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center px-1">
          <span class="text-xs font-bold text-muted uppercase">Preview</span>
        </div>
        <article
          class="border border-default rounded-lg p-6 bg-white dark:bg-gray-900 overflow-auto h-full max-h-[800px]"
        >
          <MDC :value="body" class="content" />
        </article>
      </div>
    </div>

    <section class="border border-default rounded-lg p-4 bg-muted/10">
      <div class="flex items-center justify-between mb-4 border-b border-default pb-2">
        <h3 class="font-bold flex items-center gap-2">
          <u-icon name="i-heroicons-history" />
          編集履歴
        </h3>
        <u-button
          variant="ghost"
          size="sm"
          icon="i-heroicons-arrow-path"
          :loading="loadingHistory"
          @click="loadHistory"
        >
          再読み込み
        </u-button>
      </div>

      <ul class="space-y-3 max-h-80 overflow-auto pr-2">
        <li
          v-for="item in revisions"
          :key="`${item.path}:${item.revision}`"
          class="border border-default rounded-lg p-3 bg-white dark:bg-gray-800/50 hover:border-primary/50 transition-colors"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded"
                  >r{{ item.revision }}</span
                >
                <span class="text-sm font-medium">{{ item.updatedBy }}</span>
              </div>
              <p class="text-xs text-muted mb-1">{{ item.updatedAt }}</p>
              <p v-if="item.message" class="text-sm text-gray-700 dark:text-gray-300 italic">{{ item.message }}</p>
            </div>
            <u-button
              size="sm"
              variant="subtle"
              :loading="restoring === item.revision"
              :disabled="restoring !== null"
              @click="restore(item.revision)"
            >
              復元
            </u-button>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>
