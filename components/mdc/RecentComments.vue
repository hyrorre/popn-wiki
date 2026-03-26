<script setup lang="ts">
type RecentComment = {
  path: string
  created_at: string
  commenter: string
}

const props = withDefaults(defineProps<{
  limit?: number | string
  hideDetail?: boolean
}>(), {
  limit: 10,
  hideDetail: false
})

const { data: comments, status } = await useFetch<RecentComment[]>('/api/comment/recent', {
  query: { limit: Number(props.limit) }
})

const {format} = useAppConfig()

const formatDate = (dateStr: string) => {
  const options: Intl.DateTimeFormatOptions = {}
  if (format.option.year) options.year = format.option.year as 'numeric' | '2-digit'
  if (format.option.month) options.month = format.option.month as 'numeric' | '2-digit'
  if (format.option.date) options.day = format.option.date as 'numeric' | '2-digit'
  if (format.option.hour) options.hour = format.option.hour as 'numeric' | '2-digit'
  if (format.option.minute) options.minute = format.option.minute as 'numeric' | '2-digit'
  return new Date(dateStr).toLocaleDateString(format.locale || 'ja-JP', options)
}
</script>

<template>
  <div class="my-3">
    <p v-if="status === 'pending'" class="text-muted">読み込み中...</p>
    <p v-else-if="!comments?.length" class="text-muted">最近のコメントはありません。</p>

    <ul v-else class="space-y-1">
      <li v-for="comment in comments" :key="comment.path" class="flex items-baseline gap-2">
        <NuxtLink :to="`/${comment.path}`" class="hover:underline text-primary truncate">
          {{ comment.path }}
        </NuxtLink>
        <span v-if="!hideDetail" class="text-xs text-muted whitespace-nowrap">
          {{ comment.commenter }} · {{ formatDate(comment.created_at) }}
        </span>
      </li>
    </ul>
  </div>
</template>
