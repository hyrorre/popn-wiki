<script setup lang="ts">
import * as Diff from 'diff'
import type { Page } from '~/shared/types'

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
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isMinor = ref(false)

const isViewModalOpen = ref(false)
const isDiffModalOpen = ref(false)
const isRestoreConfirmOpen = ref(false)
const selectedRevision = ref<Page | null>(null)
const diffTarget = ref<'current' | 'previous'>('current')
const viewMode = ref<'preview' | 'markdown'>('preview')

const diffResults = computed(() => {
  if (!selectedRevision.value) return []

  let fromContent = ''
  let toContent = selectedRevision.value.body || ''

  if (diffTarget.value === 'current') {
    fromContent = selectedRevision.value.body || ''
    toContent = body.value || ''
  } else {
    // find index in revisions
    const index = revisions.value.findIndex((r) => r.revision === selectedRevision.value?.revision)
    const prev = revisions.value[index + 1]
    fromContent = prev?.body || ''
    toContent = selectedRevision.value.body || ''
  }

  return Diff.diffLines(fromContent, toContent)
})

const openViewModal = (item: Page) => {
  selectedRevision.value = item
  isViewModalOpen.value = true
}

const openDiffModal = (item: Page, target: 'current' | 'previous') => {
  diffTarget.value = target
  selectedRevision.value = item
  isDiffModalOpen.value = true
}

const openRestoreConfirm = (item: Page) => {
  selectedRevision.value = item
  isRestoreConfirmOpen.value = true
}

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
        message: message.value,
        minor: isMinor.value ? 1 : 0
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
    errorMessage.value = '復元に失敗しました。'
  } finally {
    restoring.value = null
  }
}

const isDirty = computed(() => body.value !== props.initialBody)

defineExpose({
  isDirty
})

await loadHistory()
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-3 items-center justify-between bg-muted/30 p-2 rounded-lg border border-default">
      <div class="flex gap-2 items-center flex-1 min-w-[300px]">
        <u-button icon="i-lucide-check" :loading="saving" @click="save">
          {{ saving ? '保存中...' : '保存' }}
        </u-button>
        <u-button variant="outline" color="neutral" :disabled="saving" @click="$emit('cancel')">キャンセル</u-button>
        <u-input
          v-model="message"
          type="text"
          class="flex-1"
          placeholder="変更メッセージ（任意）"
          icon="i-lucide-message-square-text"
        />
        <u-checkbox v-model="isMinor" label="小変更" class="text-xs" />
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
        <MarkdownToolbar v-model="body" :textarea="textareaRef" />
        <textarea
          ref="textareaRef"
          v-model="body"
          class="border border-default rounded-t-none rounded-b-lg p-4 w-full h-full min-h-[400px] font-mono text-sm leading-relaxed focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
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
          <u-icon name="i-lucide-history" />
          編集履歴
        </h3>
        <u-button
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
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
                <span class="text-sm font-medium">{{ item.userName || item.updatedBy }}</span>
              </div>
              <p class="text-xs text-muted mb-1">{{ item.updatedAt }}</p>
              <p v-if="item.message" class="text-sm text-gray-700 dark:text-gray-300 italic">{{ item.message }}</p>
            </div>
            <div class="flex items-center gap-2">
              <u-button size="sm" variant="ghost" icon="i-lucide-eye" @click="openViewModal(item)"> 表示 </u-button>
              <u-button
                size="sm"
                variant="ghost"
                icon="i-lucide-arrow-left-right"
                @click="openDiffModal(item, 'current')"
              >
                現在との差分
              </u-button>
              <u-button
                size="sm"
                variant="ghost"
                icon="i-lucide-undo-2"
                :disabled="revisions.indexOf(item) === revisions.length - 1"
                @click="openDiffModal(item, 'previous')"
              >
                前回との差分
              </u-button>
              <u-button
                size="sm"
                variant="subtle"
                color="primary"
                :loading="restoring === item.revision"
                :disabled="restoring !== null"
                @click="openRestoreConfirm(item)"
              >
                復元
              </u-button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- リビジョン内容確認モーダル -->
    <u-modal
      v-model:open="isViewModalOpen"
      :title="`Revision ${selectedRevision?.revision} の内容`"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-end">
            <u-form-field label="プレビュー表示" name="viewMode" size="sm">
              <u-switch
                :model-value="viewMode === 'preview'"
                @update:model-value="(val) => (viewMode = val ? 'preview' : 'markdown')"
              />
            </u-form-field>
          </div>

          <div class="max-h-[70vh] overflow-auto p-4 bg-muted/10 rounded-lg">
            <template v-if="selectedRevision">
              <MDC
                v-if="viewMode === 'preview'"
                :value="selectedRevision.body"
                class="content bg-white dark:bg-gray-900 p-4 rounded shadow-sm"
              />
              <pre v-else class="whitespace-pre-wrap font-mono text-sm bg-gray-50 dark:bg-gray-800/50 p-4 rounded">{{
                selectedRevision.body
              }}</pre>
            </template>
          </div>
        </div>
      </template>
    </u-modal>

    <!-- 差分確認モーダル -->
    <u-modal
      v-model:open="isDiffModalOpen"
      :title="
        diffTarget === 'current'
          ? '現在の編集内容との差分'
          : `Revision ${selectedRevision?.revision} とその前回との差分`
      "
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <div class="max-h-[70vh] overflow-auto bg-white dark:bg-gray-900 rounded-lg font-mono text-sm">
          <div
            v-for="(part, index) in diffResults"
            :key="index"
            :class="[
              'whitespace-pre-wrap px-2 py-0.5',
              part.added ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : '',
              part.removed ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' : ''
            ]"
          >
            <span v-if="part.added" class="inline-block w-4 opacity-50">+</span>
            <span v-else-if="part.removed" class="inline-block w-4 opacity-50">-</span>
            <span>{{ part.value }}</span>
          </div>
        </div>
      </template>
    </u-modal>

    <!-- 復元確認モーダル -->
    <u-modal
      v-model:open="isRestoreConfirmOpen"
      title="リビジョンの復元"
      description="このリビジョンの内容で現在のページを上書きします。よろしいですか？"
    >
      <template #footer>
        <div class="flex justify-end gap-3">
          <u-button variant="ghost" color="neutral" @click="isRestoreConfirmOpen = false">キャンセル</u-button>
          <u-button
            color="primary"
            @click="
              () => {
                restore(selectedRevision!.revision)
                isRestoreConfirmOpen = false
              }
            "
          >
            復元を実行する
          </u-button>
        </div>
      </template>
    </u-modal>
  </section>
</template>
