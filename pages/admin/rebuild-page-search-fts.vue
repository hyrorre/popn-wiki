<script setup lang="ts">
type RebuildPageSearchFtsResult = {
  scanned: number
  indexed: number
  done: boolean
  reset: boolean
  nextCursor?: string
  skipped?: string
}

const { user } = useUserSession()
const { setCanEdit, setRevision } = usePageActions()
const { app } = useAppConfig()

const limit = ref(50)
const cursor = ref('')
const result = ref<RebuildPageSearchFtsResult | null>(null)
const errorMessage = ref('')
const pending = ref(false)

const isAdmin = computed(() => user.value?.role === 'admin')
const hasResult = computed(() => result.value !== null)

watchEffect(() => {
  setCanEdit(false)
  setRevision(null)
})

useSeoMeta({
  title: 'ページ検索FTS再構築',
  description: 'ページ検索FTS再構築',
  ogTitle: 'ページ検索FTS再構築',
  ogDescription: 'ページ検索FTS再構築',
  ogUrl: `${app.url}/admin/rebuild-page-search-fts`,
  robots: 'noindex'
})

async function runRebuild(reset: boolean) {
  if (!isAdmin.value || pending.value) return

  pending.value = true
  errorMessage.value = ''

  try {
    const requestedCursor = reset ? '' : cursor.value.trim()
    result.value = await $fetch<RebuildPageSearchFtsResult>('/api/admin/rebuild-page-search-fts', {
      method: 'POST',
      body: {
        limit: limit.value,
        reset,
        cursor: requestedCursor || undefined
      }
    })
    cursor.value = result.value.nextCursor || ''
  } catch (error) {
    const fetchError = error as { data?: { message?: string }; message?: string }
    errorMessage.value = fetchError.data?.message || fetchError.message || 'FTS再構築に失敗しました。'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <Header />

  <UContainer class="py-10">
    <div v-if="isAdmin" class="mx-auto flex max-w-3xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">ページ検索FTS再構築</h1>
        <p class="text-sm text-muted">rebuild-page-search-fts</p>
      </div>

      <UCard>
        <div class="grid gap-4 md:grid-cols-[140px_1fr_auto_auto] md:items-end">
          <UFormField label="処理件数">
            <UInput v-model.number="limit" type="number" min="1" max="200" />
          </UFormField>

          <UFormField label="cursor">
            <UInput v-model="cursor" placeholder="未指定" />
          </UFormField>

          <UButton icon="i-lucide-refresh-cw" :loading="pending" @click="runRebuild(true)">最初から実行</UButton>
          <UButton
            icon="i-lucide-play"
            :loading="pending"
            :disabled="!cursor"
            variant="soft"
            @click="runRebuild(false)"
          >
            続きから実行
          </UButton>
        </div>
      </UCard>

      <UAlert
        v-if="errorMessage"
        icon="i-lucide-triangle-alert"
        color="error"
        variant="soft"
        title="エラー"
        :description="errorMessage"
      />

      <UCard v-if="hasResult && result">
        <template #header>
          <div class="flex flex-wrap gap-2">
            <UBadge color="info" variant="soft">取得: {{ result.scanned }}</UBadge>
            <UBadge color="success" variant="soft">登録: {{ result.indexed }}</UBadge>
            <UBadge :color="result.done ? 'success' : 'warning'" variant="soft">
              {{ result.done ? '完了' : '継続あり' }}
            </UBadge>
            <UBadge v-if="result.skipped" color="warning" variant="soft">スキップ</UBadge>
          </div>
        </template>

        <div class="space-y-5">
          <UAlert
            v-if="result.skipped"
            icon="i-lucide-circle-alert"
            color="warning"
            variant="soft"
            title="再構築をスキップしました"
            :description="result.skipped"
          />

          <UAlert
            v-else-if="result.done"
            icon="i-lucide-circle-check"
            color="success"
            variant="soft"
            title="再構築が完了しました"
          />

          <div v-else class="flex flex-wrap items-center gap-3">
            <UBadge color="neutral" variant="soft">next: {{ result.nextCursor }}</UBadge>
            <UButton icon="i-lucide-play" :loading="pending" @click="runRebuild(false)">続きから実行</UButton>
          </div>
        </div>
      </UCard>
    </div>

    <div v-else class="py-12 text-center">
      <p class="text-muted text-lg">管理者権限が必要です。</p>
      <UButton v-if="!user" class="mt-4" to="/signin" icon="i-lucide-log-in">ログインページへ</UButton>
    </div>
  </UContainer>

  <Footer />
</template>
