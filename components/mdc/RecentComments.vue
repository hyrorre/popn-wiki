<script setup lang="ts">
type RecentComment = {
  path: string
  title?: string
  created_at: string
  commenter: string
}
type Response = { data: RecentComment[]; total: number }

const props = withDefaults(
  defineProps<{
    limit?: number | string
    hideDetail?: boolean | string
  }>(),
  {
    limit: 10,
    hideDetail: false
  }
)

const container = ref<HTMLElement | null>(null)
const page = ref(1)
const jumpPage = ref(1)

const { data: response, status } = await useFetch<Response>('/api/comment/recent', {
  query: { limit: Number(props.limit), page }
})

const comments = computed(() => response.value?.data ?? [])
const total = computed(() => response.value?.total ?? 0)
const maxPage = computed(() => Math.ceil(total.value / Number(props.limit)))

const handleJump = () => {
  const p = parseInt(jumpPage.value.toString())
  if (!isNaN(p) && p >= 1 && p <= maxPage.value) {
    page.value = p
  } else {
    jumpPage.value = page.value
  }
}

watch(page, (newVal) => {
  jumpPage.value = newVal
  container.value?.scrollIntoView()
})
</script>

<template>
  <div ref="container" class="my-3">
    <p v-if="status === 'pending'" class="text-muted">読み込み中...</p>
    <p v-else-if="!comments.length" class="text-muted">最近のコメントはありません。</p>

    <ul v-else>
      <li v-for="comment in comments" :key="comment.path">
        <NuxtLink :to="`/${comment.path}`">
          {{ comment.title || comment.path }}
        </NuxtLink>
        <span v-if="!hideDetail" class="ms-2 text-xs text-muted whitespace-nowrap">
          {{ comment.commenter }} · {{ formatDate(comment.created_at) }}
        </span>
      </li>
    </ul>

    <div
      v-if="!hideDetail && total > Number(limit)"
      class="flex flex-col md:flex-row items-center justify-center gap-5 mt-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-default"
    >
      <div class="text-sm font-medium text-muted">
        全 <span class="text-foreground">{{ total }}</span> 件 /
        全 <span class="text-foreground">{{ maxPage }}</span> ページ
      </div>

      <u-pagination v-model:page="page" :total="total" :items-per-page="Number(limit)" size="md" color="primary" />

      <div class="flex items-center gap-2">
        <u-input v-model="jumpPage" type="number" size="sm" class="w-16" :min="1" :max="maxPage" @keyup.enter="handleJump" />
        <span class="text-xs text-muted font-medium">ページへ</span>
        <u-button size="xs" color="neutral" variant="ghost" icon="i-lucide-search" @click="handleJump" />
      </div>
    </div>
  </div>
</template>
