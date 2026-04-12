<script setup lang="ts">
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
    <template v-if="page">
      <MDCRenderer v-if="mdcAst" :body="mdcAst.body" :data="mdcAst.data" class="content" />
      <MDC v-else :value="page.body" class="content" />
    </template>
  </aside>
</template>
