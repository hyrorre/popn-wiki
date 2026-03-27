<script setup lang="ts">
import type { Page } from '~/types'

type RecentPage = Pick<Page, 'path' | 'revision' | 'message' | 'updatedBy' | 'updatedAt'>

const props = withDefaults(defineProps<{
  limit?: number | string
  hideDetail?: boolean
}>(), {
  limit: 10,
  hideDetail: false
})

const { data: pages, status } = await useFetch<RecentPage[]>('/api/page/recent', {
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
    <p v-else-if="!pages?.length" class="text-muted">最近の編集はありません。</p>

    <ul v-else class="space-y-1">
      <li v-for="page in pages" :key="page.path" class="flex items-baseline gap-2">
        <NuxtLink :to="`/${page.path}`" class="hover:underline text-primary truncate">
          {{ page.path }}
        </NuxtLink>
        <span v-if="!hideDetail" class="text-xs text-muted whitespace-nowrap">{{ formatDate(page.updatedAt) }}</span>
      </li>
    </ul>
  </div>
</template>
