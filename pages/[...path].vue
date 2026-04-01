<script setup lang="ts">
import type { Page } from '~/types'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'

const route = useRoute()
const { user } = useUserSession()
const { editMode, isSidebarOpen, setEditMode, setRevision, setCanEdit } = usePageActions()

const createMode = ref(false)
const conflictMessage = ref('')
const deleting = ref(false)

const path = (typeof route.params.path === 'string' ? route.params.path : route.params.path?.join('/')) || '/'

// includeDeleted=true で取得し、フロントで状態を判定
const {
  data: page,
  error: fetchError,
  refresh
} = await useFetch('/api/page', {
  query: { path, includeDeleted: 'true' }
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

const onSaved = async (saved: Page) => {
  conflictMessage.value = ''
  page.value = saved
  setEditMode(false)
  createMode.value = false
  await refresh()
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
  if (!confirm('このページを削除しますか？この操作は履歴から差し戻しで復元できます。')) return
  deleting.value = true
  try {
    await $fetch('/api/page', {
      method: 'DELETE',
      body: { path }
    })
    await refresh()
    setEditMode(false)
  } catch {
    alert('削除に失敗しました。')
  } finally {
    deleting.value = false
  }
}

// 新規作成モードを開始
const startCreate = () => {
  createMode.value = true
}

// 削除済みページを復元（エディタを開く）
const startRestore = () => {
  setEditMode(true)
}

// @nuxtjs/mdc の公式パーサを利用して Frontmatter を安全に解析
const { data: mdcAst } = await useAsyncData(
  `page-ast-${path}`,
  async () => {
    if (!page.value?.body) return null
    return await parseMarkdown(page.value.body)
  },
  { watch: [page] }
)

const hasDiscussion = computed(() => {
  return mdcAst.value?.data?.discussion === true
})

// TODO: 見出しより前にアンカーなどがあると機能しない不具合を修正
useHead({
  title: mdcAst.value?.data?.title || ''
})
</script>

<template>
  <Header />

  <u-container class="flex flex-col lg:flex-row gap-4">
    <!-- デスクトップ用サイドバー -->
    <Sidebar class="hidden lg:block border-r border-default min-w-[200px] max-w-[250px]" />

    <!-- モバイル用サイドバー (Slideover) -->
    <u-slideover v-model:open="isSidebarOpen" title="Menu" side="left">
      <template #body>
        <Sidebar @click="isSidebarOpen = false" />
      </template>
    </u-slideover>

    <main class="w-full pb-12 overflow-hidden">
      <!-- ページが存在しない場合 -->
      <template v-if="pageNotFound">
        <div v-if="user" class="py-8">
          <!-- 新規作成モード -->
          <template v-if="createMode">
            <WikiEditor
              :path="path"
              :initial-body="''"
              :base-revision="0"
              @saved="onSaved"
              @cancel="createMode = false"
              @conflict="onConflict"
            />
          </template>
          <div v-else class="text-center py-12">
            <p class="text-muted mb-6 text-lg">このページはまだ存在しません。</p>
            <u-button size="lg" icon="i-heroicons-plus" @click="startCreate">新規作成</u-button>
          </div>
        </div>
        <div v-else class="py-12 text-center">
          <p class="text-muted text-lg">ページが見つかりません。</p>
        </div>
      </template>

      <!-- 削除済みページ -->
      <template v-else-if="isDeleted">
        <div v-if="user" class="py-8">
          <template v-if="editMode">
            <WikiEditor
              :path="path"
              :initial-body="''"
              :base-revision="page!.revision"
              @saved="onSaved"
              @cancel="setEditMode(false)"
              @conflict="onConflict"
            />
          </template>
          <div v-else class="text-center py-12">
            <p class="text-muted mb-6 text-lg">このページは削除されています。</p>
            <u-button size="lg" icon="i-heroicons-arrow-path-rounded-square" @click="startRestore">
              新規作成 または 復元
            </u-button>
          </div>
        </div>
        <div v-else class="py-12 text-center">
          <p class="text-muted text-lg">ページが見つかりません。</p>
        </div>
      </template>

      <!-- 通常のページ表示 -->
      <template v-else-if="page">
        <div v-if="editMode" class="mb-8">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            <u-icon name="i-heroicons-pencil-square" class="text-primary" />
            編集モード
          </h2>
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
          v-if="editMode"
          :path="path"
          :initial-body="page.body"
          :base-revision="page.revision"
          @saved="onSaved"
          @cancel="setEditMode(false)"
          @conflict="onConflict"
        />

        <MDC v-else :value="page.body" class="content" />

        <!-- 編集モード時の下部アクション -->
        <div v-if="editMode" class="mt-12 pt-8 border-t border-default flex justify-center">
          <u-button
            class="text-red-600 border-red-300"
            variant="outline"
            icon="i-heroicons-trash"
            size="lg"
            :disabled="deleting"
            @click="deletePage"
          >
            {{ deleting ? '削除中...' : 'このページを削除する' }}
          </u-button>
        </div>

        <!-- ディスカッション機能 -->
        <div v-if="hasDiscussion && !editMode" class="mt-12 pt-8 border-t border-default">
          <Discussion :path="path" />
        </div>
      </template>
    </main>
  </u-container>
  <Footer />
</template>
