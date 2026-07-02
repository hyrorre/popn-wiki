<script setup lang="ts">
const route = useRoute()
const { user } = useUserSession()
const { isSidebarOpen, setRevision, setCanEdit } = usePageActions()
const { app } = useAppConfig()

const conflictMessage = ref('')
const deleting = ref(false)
const isSaved = ref(false)
const editorRef = ref()

const path = (typeof route.params.path === 'string' ? route.params.path : route.params.path?.join('/')) || '/'

onBeforeRouteLeave(() => {
  if (editorRef.value?.isDirty && !isSaved.value) {
    if (!confirm('変更が保存されていません。移動しますか？')) {
      return false
    }
  }
})

// ブラウザを閉じる際のアラート
if (import.meta.client) {
  window.onbeforeunload = (e) => {
    if (editorRef.value?.isDirty && !isSaved.value) {
      e.preventDefault()
      e.returnValue = ''
    }
  }
}

const {
  data: page,
  error: fetchError,
  refresh
} = await useFetch('/api/page', {
  query: { path, fresh: '1' }
})

// ページの状態
const pageNotFound = computed(() => !page.value && !!fetchError.value)
const isDeleted = computed(() => page.value?.body === '')

watchEffect(() => {
  setCanEdit(!!user.value)
  if (page.value) {
    setRevision(page.value.revision)
  } else {
    setRevision(null)
  }
})

useSeoMeta({
  title: `${path} を編集`,
  ogTitle: `${path} を編集`,
  ogUrl: `${app.url}/edit/${path}`,
  robots: 'noindex'
})

const onSaved = async () => {
  conflictMessage.value = ''
  isSaved.value = true
  await navigateTo(`/${path}`.replace('//', '/'))
}

const onCancel = async () => {
  await navigateTo(`/${path}`.replace('//', '/'))
}

const onConflict = (latestRevision: number) => {
  conflictMessage.value = `競合が発生しました。最新 revision は ${latestRevision} です。再読込してから再編集してください。`
}

const reloadLatest = async () => {
  conflictMessage.value = ''
  await refresh()
}

// ページ削除
const deletePage = async () => {
  if (!confirm('このページを削除しますか？この操作は履歴から復元できます。')) return
  deleting.value = true
  try {
    await $fetch('/api/page', {
      method: 'DELETE',
      query: { path }
    })
    await navigateTo(`/${path}`)
  } catch {
    alert('削除に失敗しました。')
  } finally {
    deleting.value = false
  }
}

useHead({
  title: page.value ? `編集: ${path}` : '新規作成'
})
</script>

<template>
  <Header />

  <u-container class="flex flex-col gap-4">
    <!-- モバイル用サイドバー (Slideover) -->
    <u-slideover v-model:open="isSidebarOpen" title="Menu" side="left">
      <template #body>
        <Sidebar />
      </template>
    </u-slideover>

    <main class="w-full pb-12 overflow-hidden">
      <div v-if="!user" class="py-12 text-center">
        <p class="text-muted text-lg">編集するにはログインが必要です。</p>
        <u-button class="mt-4" to="/signin">ログインページへ</u-button>
      </div>

      <template v-else>
        <div class="mb-8">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            <u-icon name="i-lucide-square-pen" class="text-primary" />
            {{ pageNotFound || isDeleted ? '新規作成' : '編集モード' }}
          </h2>
          <p class="text-muted text-sm mt-1">パス : {{ path === '/' ? '/' : '/' + path }}</p>
        </div>

        <u-alert
          v-if="conflictMessage"
          color="error"
          variant="subtle"
          :title="conflictMessage"
          class="mb-4"
          :actions="[{ label: '最新版を再読込', onClick: reloadLatest }]"
        />

        <WikiEditor
          ref="editorRef"
          :path="path"
          :initial-body="page?.body || ''"
          :base-revision="page?.revision || 0"
          @saved="onSaved"
          @cancel="onCancel"
          @conflict="onConflict"
        />

        <!-- 下部アクション -->
        <div v-if="page && !isDeleted" class="mt-12 pt-8 border-t border-default flex justify-center">
          <u-button
            class="text-red-600 border-red-300"
            variant="outline"
            icon="i-lucide-trash-2"
            size="lg"
            :disabled="deleting"
            @click="deletePage"
          >
            {{ deleting ? '削除中...' : 'このページを削除する' }}
          </u-button>
        </div>
      </template>
    </main>
  </u-container>
  <Footer />
</template>
