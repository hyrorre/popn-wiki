<script setup lang="ts">
import type { Page } from '~/types'

const route = useRoute()
const user = useSupabaseUser()
const editMode = ref(false)
const conflictMessage = ref('')

useHead({
  titleTemplate: '%s'
})

const path = (typeof(route.params.path) === 'string' ? route.params.path : route.params.path?.join('/')) || '/'

const { data: page, refresh } = await useFetch('/api/page', {
  query: { path }
})

const onSaved = async (saved: Page) => {
  conflictMessage.value = ''
  page.value = saved
  editMode.value = false
  await refresh()
}

const onConflict = (latestRevision: number) => {
  conflictMessage.value = `競合が発生しました。最新 revision は ${latestRevision} です。再読込してから再編集してください。`
}

const reloadLatest = async () => {
  conflictMessage.value = ''
  await refresh()
}
</script>

<template>
  <Header />
  <u-container class="flex">
    <Sidebar class="border-r border-default max-w-[200px]" />
    <main class="w-full pl-4">
      <div v-if="user && page" class="mb-4 flex items-center gap-2">
        <button class="border px-3 py-1 rounded" @click="editMode = !editMode">
          {{ editMode ? '閲覧に戻る' : '編集する' }}
        </button>
        <span class="text-sm text-muted">revision: {{ page.revision }}</span>
      </div>

      <p v-if="conflictMessage" class="text-red-600 mb-3">
        {{ conflictMessage }}
        <button class="underline ml-2" @click="reloadLatest">最新版を再読込</button>
      </p>

      <WikiEditor
        v-if="editMode && page"
        :path="path"
        :initial-body="page.body"
        :base-revision="page.revision"
        @saved="onSaved"
        @cancel="editMode = false"
        @conflict="onConflict"
      />
      <MDC v-else-if="page" :value="page.body" class="content" />
    </main>
  </u-container>
  <Footer />
</template>
