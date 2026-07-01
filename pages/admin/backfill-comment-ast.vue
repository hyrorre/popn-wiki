<script setup lang="ts">
type BackfillCommentAstResult = {
  scanned: number
  updated: number
  failed: Array<{ id: number; message: string }>
  touchedPaths: string[]
}

const { user } = useUserSession()
const { setCanEdit, setRevision } = usePageActions()
const { app } = useAppConfig()

const limit = ref(100)
const path = ref('')
const result = ref<BackfillCommentAstResult | null>(null)
const errorMessage = ref('')
const pending = ref(false)

const isAdmin = computed(() => user.value?.role === 'admin')
const hasResult = computed(() => result.value !== null)
const failedCount = computed(() => result.value?.failed.length ?? 0)
const touchedPathCount = computed(() => result.value?.touchedPaths.length ?? 0)

watchEffect(() => {
  setCanEdit(false)
  setRevision(null)
})

useSeoMeta({
  title: 'コメントAST Backfill',
  description: 'コメントAST Backfill',
  ogTitle: 'コメントAST Backfill',
  ogDescription: 'コメントAST Backfill',
  ogUrl: `${app.url}/admin/backfill-comment-ast`,
  robots: 'noindex'
})

async function runBackfill() {
  if (!isAdmin.value || pending.value) return

  pending.value = true
  errorMessage.value = ''

  try {
    result.value = await $fetch<BackfillCommentAstResult>('/api/admin/backfill-comment-ast', {
      method: 'POST',
      body: {
        limit: limit.value,
        path: path.value.trim() || undefined
      }
    })
  } catch (error) {
    const fetchError = error as { data?: { message?: string }; message?: string }
    errorMessage.value = fetchError.data?.message || fetchError.message || 'Backfillに失敗しました。'
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">コメントAST Backfill</h1>
        <p class="text-sm text-muted">comments:backfill-ast</p>
      </div>

      <UCard>
        <div class="grid gap-4 md:grid-cols-[160px_1fr_auto] md:items-end">
          <UFormField label="処理件数">
            <UInput v-model.number="limit" type="number" min="1" max="500" />
          </UFormField>

          <UFormField label="対象path">
            <UInput v-model="path" placeholder="未指定" />
          </UFormField>

          <UButton icon="i-lucide-play" :loading="pending" @click="runBackfill">実行</UButton>
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
            <UBadge color="success" variant="soft">更新: {{ result.updated }}</UBadge>
            <UBadge :color="failedCount > 0 ? 'warning' : 'neutral'" variant="soft">失敗: {{ failedCount }}</UBadge>
            <UBadge color="neutral" variant="soft">対象path: {{ touchedPathCount }}</UBadge>
          </div>
        </template>

        <div class="space-y-5">
          <UAlert
            v-if="result.scanned === 0"
            icon="i-lucide-circle-check"
            color="success"
            variant="soft"
            title="未処理のコメントはありません"
          />

          <div v-if="result.touchedPaths.length" class="space-y-2">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">更新されたpath</h2>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="touchedPath in result.touchedPaths" :key="touchedPath" color="neutral" variant="soft">
                {{ touchedPath }}
              </UBadge>
            </div>
          </div>

          <div v-if="result.failed.length" class="space-y-2">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">失敗</h2>
            <ul class="space-y-2">
              <li
                v-for="failure in result.failed"
                :key="failure.id"
                class="rounded-md border border-default bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"
              >
                <span class="font-medium">#{{ failure.id }}</span>
                <span class="ml-2 text-muted">{{ failure.message }}</span>
              </li>
            </ul>
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
