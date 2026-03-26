<script setup lang="ts">
import type { Page } from '~/types'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'

const route = useRoute()
const user = useSupabaseUser()
const editMode = ref(false)
const createMode = ref(false)
const conflictMessage = ref('')
const deleting = ref(false)

const path = (typeof(route.params.path) === 'string' ? route.params.path : route.params.path?.join('/')) || '/'

// includeDeleted=true で取得し、フロントで状態を判定
const { data: page, error: fetchError, refresh } = await useFetch('/api/page', {
  query: { path, includeDeleted: 'true' }
})

// ページの状態
const pageNotFound = computed(() => !page.value && !!fetchError.value)
const isDeleted = computed(() => page.value?.body === '')

const onSaved = async (saved: Page) => {
  conflictMessage.value = ''
  page.value = saved
  editMode.value = false
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
    editMode.value = false
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
  editMode.value = true
}

// @nuxtjs/mdc の公式パーサを利用して Frontmatter を安全に解析
const { data: mdcAst } = await useAsyncData(`page-ast-${path}`, async () => {
  if (!page.value?.body) return null
  return await parseMarkdown(page.value.body)
}, { watch: [page] })

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
  <u-container class="flex">
    <Sidebar class="border-r border-default max-w-[200px]" />
    <main class="w-full pl-4 pb-12">
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
          <template v-else>
            <p class="text-muted mb-4">このページはまだ存在しません。</p>
            <button class="border px-3 py-1 rounded" @click="startCreate">
              新規作成
            </button>
          </template>
        </div>
        <div v-else class="py-8">
          <p class="text-muted">ページが見つかりません。</p>
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
              @cancel="editMode = false"
              @conflict="onConflict"
            />
          </template>
          <template v-else>
            <p class="text-muted mb-4">このページは削除されています。</p>
            <button class="border px-3 py-1 rounded" @click="startRestore">
              新規作成 または 復元
            </button>
          </template>
        </div>
        <div v-else class="py-8">
          <p class="text-muted">ページが見つかりません。</p>
        </div>
      </template>

      <!-- 通常のページ表示 -->
      <template v-else-if="page">
        <div v-if="user" class="mb-4 flex items-center gap-2">
          <button class="border px-3 py-1 rounded" @click="editMode = !editMode">
            {{ editMode ? '閲覧に戻る' : '編集する' }}
          </button>
          <button
            v-if="editMode"
            class="border px-3 py-1 rounded text-red-600 border-red-300"
            :disabled="deleting"
            @click="deletePage"
          >
            {{ deleting ? '削除中...' : '削除' }}
          </button>
          <span class="text-sm text-muted">revision: {{ page.revision }}</span>
        </div>

        <p v-if="conflictMessage" class="text-red-600 mb-3">
          {{ conflictMessage }}
          <button class="underline ml-2" @click="reloadLatest">最新版を再読込</button>
        </p>

        <WikiEditor
          v-if="editMode"
          :path="path"
          :initial-body="page.body"
          :base-revision="page.revision"
          @saved="onSaved"
          @cancel="editMode = false"
          @conflict="onConflict"
        />

        <MDC v-else :value="page.body" class="content" />

        <!-- ディスカッション機能 -->
        <div v-if="hasDiscussion && !editMode" class="mt-8 pt-8 border-t border-default">
          <Discussion :path="path" />
        </div>
      </template>
    </main>
  </u-container>
  <Footer />
</template>
