<script setup lang="ts">
const route = useRoute()
const { user } = useUserSession()
const { isSidebarOpen, setRevision, setCanEdit } = usePageActions()

const path = (typeof route.params.path === 'string' ? route.params.path : route.params.path?.join('/')) || '/'

// includeDeleted=true で取得し、フロントで状態を判定
const { data: page, error: fetchError } = await useFetch('/api/page', {
  query: { path, includeDeleted: 'true' }
})

// ページの状態
const pageNotFound = computed(() => !page.value && !!fetchError.value)
const isDeleted = computed(() => page.value?.body === '')

// AST をパースして保持（API からは JSON 文字列で届く）
const mdcAst = computed(() => {
  if (!page.value?.bodyAst) return null
  try {
    return typeof page.value.bodyAst === 'string' ? JSON.parse(page.value.bodyAst) : page.value.bodyAst
  } catch {
    return null
  }
})

watchEffect(() => {
  setCanEdit(!!user.value)
  if (page.value) {
    setRevision(page.value.revision)
  } else {
    setRevision(null)
  }
})

const hasDiscussion = computed(() => {
  return mdcAst.value?.data?.discussion === true
})

useHead({
  title: mdcAst.value?.data?.title || (page.value ? path : 'Page Not Found')
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
        <Sidebar />
      </template>
    </u-slideover>

    <main class="w-full overflow-hidden">
      <!-- ページが存在しない場合 -->
      <template v-if="pageNotFound">
        <div class="py-12 text-center">
          <p class="text-muted mb-6 text-lg">このページはまだ存在しません。</p>
          <u-button v-if="user" size="lg" icon="i-lucide-plus" :to="`/edit/${path}`">新規作成</u-button>
        </div>
      </template>

      <!-- 削除済みページ -->
      <template v-else-if="isDeleted">
        <div class="text-center py-12">
          <p class="text-muted mb-6 text-lg">このページは削除されています。</p>
          <u-button v-if="user" size="lg" icon="i-lucide-rotate-ccw" :to="`/edit/${path}`">
            新規作成 または 復元
          </u-button>
        </div>
      </template>

      <!-- 通常のページ表示 -->
      <template v-else-if="page">
        <!-- キャッシュされた AST があれば MDCRenderer を使用し、なければ MDC Components を使用（案Aのフォールバック） -->
        <MDCRenderer v-if="mdcAst" :body="mdcAst.body" :data="mdcAst.data" class="content" />
        <MDC v-else :value="page.body" class="content" />

        <!-- ディスカッション機能 -->
        <div v-if="hasDiscussion" class="mt-12 pt-8 border-t border-default">
          <Discussion :path="path" />
        </div>
      </template>
    </main>
  </u-container>
  <Footer />
</template>
