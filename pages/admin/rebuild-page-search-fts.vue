<script setup lang="ts">
type RebuildPageSearchFtsResult = {
  indexed: number
  skipped?: string
}

const { user } = useUserSession()
const { setCanEdit, setRevision } = usePageActions()
const { app } = useAppConfig()

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

async function runRebuild() {
  if (!isAdmin.value || pending.value) return

  pending.value = true
  errorMessage.value = ''

  try {
    result.value = await $fetch<RebuildPageSearchFtsResult>('/api/admin/rebuild-page-search-fts', {
      method: 'POST'
    })
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
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap gap-2">
            <UBadge color="neutral" variant="soft">page_search_fts</UBadge>
            <UBadge color="neutral" variant="soft">最新表示ページ</UBadge>
          </div>
          <UButton icon="i-lucide-refresh-cw" :loading="pending" @click="runRebuild">再構築</UButton>
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
            <UBadge color="success" variant="soft">登録: {{ result.indexed }}</UBadge>
            <UBadge v-if="result.skipped" color="warning" variant="soft">スキップ</UBadge>
          </div>
        </template>

        <UAlert
          v-if="result.skipped"
          icon="i-lucide-circle-alert"
          color="warning"
          variant="soft"
          title="再構築をスキップしました"
          :description="result.skipped"
        />

        <UAlert
          v-else
          icon="i-lucide-circle-check"
          color="success"
          variant="soft"
          title="再構築が完了しました"
        />
      </UCard>
    </div>

    <div v-else class="py-12 text-center">
      <p class="text-muted text-lg">管理者権限が必要です。</p>
      <UButton v-if="!user" class="mt-4" to="/signin" icon="i-lucide-log-in">ログインページへ</UButton>
    </div>
  </UContainer>

  <Footer />
</template>
