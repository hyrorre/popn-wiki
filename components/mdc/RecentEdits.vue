<script setup lang="ts">
import type { Page } from '~/shared/types'

type RecentPage = Pick<Page, 'path' | 'revision' | 'message' | 'updatedBy' | 'updatedAt' | 'title'>

const props = withDefaults(
  defineProps<{
    limit?: number | string
    hideDetail?: boolean | string
    includeMinor?: boolean | string
  }>(),
  {
    limit: 10,
    hideDetail: false,
    includeMinor: false
  }
)

const { data: pages, status } = await useFetch<RecentPage[]>('/api/page/recent', {
  query: {
    limit: Number(props.limit),
    includeMinor: props.includeMinor.toString()
  }
})

const { format } = useAppConfig()

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

    <ul v-else>
      <li v-for="page in pages" :key="page.path">
        <NuxtLink :to="`/${page.path}`">
          {{ page.title || page.path }}
        </NuxtLink>
        <span v-if="!hideDetail" class="ms-2 text-xs text-muted whitespace-nowrap">{{
          formatDate(page.updatedAt)
        }}</span>
      </li>
    </ul>
  </div>
</template>
