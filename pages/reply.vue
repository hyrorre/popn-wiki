<script setup lang="ts">
const items = [
  { label: '自分への返信', value: 'direct', icon: 'i-heroicons-chat-bubble-left-right' },
  { label: '参加スレッド', value: 'thread', icon: 'i-heroicons-user-group' }
]
const activeTab = ref('direct')

const { data: replies, status } = useFetch('/api/reply', {
  key: () => `replies-${activeTab.value}`,
  query: { type: activeTab }
})

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

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
          <u-icon name="i-heroicons-bell" class="w-8 h-8 text-primary" />
          返信一覧
        </h1>
        <p class="text-muted mt-2">あなたのコメントに対する返信や、参加しているスレッドの更新を表示します。</p>
      </div>

      <u-tabs v-model="activeTab" :items="items" class="mb-8" />

      <div v-if="status === 'pending'" class="flex justify-center py-20">
        <u-icon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-muted" />
      </div>

      <div v-else-if="replies && replies.length > 0" class="flex flex-col gap-4">
        <u-card
          v-for="reply in replies"
          :key="reply.id"
          class="hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md group"
        >
          <div class="flex items-start gap-4">
            <u-avatar :alt="reply.userName ?? '名無しさん'" size="md" class="bg-primary/10 text-primary font-bold" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-sm text-foreground truncate">{{ reply.userName }}</span>
                <span class="text-xs text-muted whitespace-nowrap">{{ formatDate(reply.createdAt) }}</span>
              </div>

              <div class="mb-3">
                <u-link
                  :to="`/${reply.path}`"
                  class="text-xs font-semibold text-primary hover:underline flex items-center gap-1 max-w-full"
                >
                  <u-icon name="i-heroicons-document-text" class="w-3.5 h-3.5 shrink-0" />
                  <span class="truncate">{{ reply.pageTitle || reply.path }}</span>
                </u-link>
              </div>

              <div
                class="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-default relative group-hover:bg-white dark:group-hover:bg-gray-900 transition-colors"
              >
                <p class="text-sm text-foreground opacity-90 line-clamp-3 leading-relaxed">
                  {{ reply.bodyPreview }}
                </p>
              </div>

              <div class="mt-4 flex justify-end">
                <u-button
                  :to="`/${reply.path}#comment-${reply.id}`"
                  variant="ghost"
                  size="sm"
                  icon="i-heroicons-arrow-right"
                  color="neutral"
                  trailing
                  class="text-xs group-hover:text-primary transition-colors"
                >
                  詳細を見る
                </u-button>
              </div>
            </div>
          </div>
        </u-card>
      </div>

      <div
        v-else
        class="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-default"
      >
        <div
          class="mb-4 bg-white dark:bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-sm"
        >
          <u-icon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="w-10 h-10 text-muted/30" />
        </div>
        <p class="text-muted font-medium">現在、新着の返信はありません。</p>
      </div>
    </div>
  </u-container>
  <Footer />
</template>

<style scoped>
/* スムーズな遷移のためのアニメーション */
.u-card {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
