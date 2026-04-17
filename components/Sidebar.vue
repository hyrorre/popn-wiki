<script setup lang="ts">
const { items } = useNavigation()

const { data: page } = await useFetch('/api/page', {
  query: { path: 'sidebar' }
})

// AST をパースして保持（API からは JSON 文字列で届く）
const mdcAst = computed(() => {
  if (!page.value?.bodyAst) return null
  try {
    return typeof page.value.bodyAst === 'string' ? JSON.parse(page.value.bodyAst) : page.value.bodyAst
  } catch {
    return null
  }
})
</script>

<template>
  <aside class="py-4 px-2 overflow-y-auto max-h-full">
    <!-- モバイル用ナビゲーション (lg未満) -->
    <div class="lg:hidden mb-4 pb-4 border-b border-default">
      <u-navigation-menu
        v-if="items[1] && items[2]"
        :items="[...items[1], ...items[2]]"
        orientation="vertical"
        content-orientation="vertical"
        class="w-full"
      />
    </div>

    <template v-if="page">
      <MDCRenderer v-if="mdcAst" :body="mdcAst.body" :data="mdcAst.data" class="content" />
      <MDC v-else :value="page.body" class="content" />
    </template>
  </aside>
</template>
