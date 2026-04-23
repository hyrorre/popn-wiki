<script setup lang="ts">
const items = [
  { label: '自分への返信', value: 'direct', icon: 'i-lucide-message-square-reply' },
  { label: '参加スレッド', value: 'thread', icon: 'i-lucide-messages-square' }
]
const activeTab = ref('direct')

const { data: replies, status } = useFetch('/api/reply', {
  key: () => `replies-${activeTab.value}`,
  query: { type: activeTab }
})

useHead({
  title: '返信一覧'
})
</script>

<template>
  <Header :show-buttons="false" />
  <u-container>
    <div class="py-8 min-h-[600px]">
      <div class="mb-8 border-b border-default pb-6">
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <u-icon name="i-lucide-bell" class="w-8 h-8 text-primary" />
          返信一覧
        </h1>
        <p class="text-muted mt-2">あなたのコメントに対する返信や、参加しているスレッドの更新を表示します。</p>
      </div>

      <u-tabs v-model="activeTab" :items="items" class="mb-8" />

      <div v-if="status === 'pending'" class="flex justify-center py-20">
        <u-icon name="i-lucide-refresh-cw" class="w-10 h-10 animate-spin text-muted" />
      </div>

      <div v-else-if="replies && replies.length > 0" class="flex flex-col gap-4">
        <CommentPanel
          v-for="reply in replies"
          :key="reply.id"
          :to="`/${reply.path}#comment-${reply.id}`"
          :author-name="reply.userName ?? '名無しさん'"
          :author-alt="reply.userName ?? '名無しさん'"
          :created-at="reply.createdAt"
          avatar-size="md"
        >
          <template #headerMeta>
            <div class="flex items-center gap-1.5 min-w-0 text-xs font-medium text-primary">
              <u-icon name="i-lucide-file-text" class="h-3.5 w-3.5 shrink-0" />
              <span class="truncate">{{ reply.pageTitle || reply.path }}</span>
            </div>
          </template>

          <div class="rounded-md border border-default bg-white/70 p-3 text-sm dark:bg-gray-900/50">
            <p class="line-clamp-3 whitespace-pre-wrap break-words opacity-90">
              {{ reply.bodyPreview }}
            </p>
          </div>

          <template #footer>
            <div class="flex items-center justify-end gap-1 text-xs font-medium text-muted group-hover:text-primary">
              <span>コメントを開く</span>
              <u-icon name="i-lucide-arrow-right" class="h-3.5 w-3.5" />
            </div>
          </template>
        </CommentPanel>
      </div>

      <div
        v-else
        class="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-default"
      >
        <div
          class="mb-4 bg-white dark:bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-sm"
        >
          <u-icon name="i-lucide-message-circle" class="w-10 h-10 text-muted/30" />
        </div>
        <p class="text-muted font-medium">現在、新着の返信はありません。</p>
      </div>
    </div>
  </u-container>
  <Footer />
</template>
