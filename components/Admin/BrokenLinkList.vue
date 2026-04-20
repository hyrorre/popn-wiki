<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface BrokenLink {
  sourcePath: string
  targetUrl: string
  text: string
  type: 'internal' | 'external' | 'image'
  error: string
}

interface BrokenLinksResponse {
  totalChecked: number
  brokenLinks: BrokenLink[]
  warnings: string[]
}

const { data, pending, error, execute } = await useFetch<BrokenLinksResponse>('/api/admin/broken-links', {
  immediate: false,
  server: false
})

const columns: TableColumn<BrokenLink>[] = [
  { accessorKey: 'sourcePath', header: 'ソースページ' },
  { accessorKey: 'type', header: '種類' },
  { accessorKey: 'text', header: 'ラベル/URL' },
  { accessorKey: 'targetUrl', header: 'リンク切れ先' },
  { id: 'actions', header: '操作' }
]

const rows = computed<BrokenLink[]>(() => data.value?.brokenLinks || [])
const warnings = computed(() => data.value?.warnings || [])

const toPagePath = (path: string) => `/${path === '/' ? '' : path}`.replace(/\/+$/, '') || '/'
const toEditPath = (path: string) => (path === '/' ? '/edit/' : `/edit/${path}`)

const getTypeLabel = (type: BrokenLink['type']) => {
  switch (type) {
    case 'internal':
      return { label: '内部', color: 'warning' as const }
    case 'image':
      return { label: '画像', color: 'error' as const }
    case 'external':
      return { label: '外部', color: 'info' as const }
    default:
      return { label: type as string, color: 'neutral' as const }
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">リンク切れチェッカー</h2>
        <p class="text-sm text-gray-500 mt-1">
          Wiki内のすべてのページをスキャンし、存在しないページへのリンクや画像を探します。
        </p>
      </div>
      <UButton icon="i-heroicons-magnifying-glass" size="lg" :loading="pending" @click="() => execute()">
        スキャンを開始
      </UButton>
    </div>

    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="warning"
      variant="soft"
      title="エラーが発生しました"
      :description="error.message"
    />

    <UAlert
      v-for="warning in warnings"
      :key="warning"
      icon="i-heroicons-exclamation-triangle"
      color="warning"
      variant="soft"
      :description="warning"
    />

    <UCard v-if="data">
      <template #header>
        <div class="flex items-center gap-4">
          <UBadge color="info" variant="soft"> チェック済みページ: {{ data.totalChecked }} </UBadge>
          <UBadge :color="rows.length > 0 ? 'warning' : 'success'" variant="soft">
            リンク切れ発見: {{ rows.length }}
          </UBadge>
        </div>
      </template>

      <UTable :columns="columns" :data="rows" :loading="pending">
        <template #sourcePath-cell="{ row }">
          <ULink :to="toPagePath(row.original.sourcePath)" class="text-primary-500 hover:underline font-medium">
            {{ toPagePath(row.original.sourcePath) }}
          </ULink>
        </template>

        <template #type-cell="{ row }">
          <UBadge :color="getTypeLabel(row.original.type).color" variant="soft" size="xs">
            {{ getTypeLabel(row.original.type).label }}
          </UBadge>
        </template>

        <template #text-cell="{ row }">
          <span class="text-sm truncate max-w-[200px] block" :title="row.original.text">
            {{ row.original.text }}
          </span>
        </template>

        <template #targetUrl-cell="{ row }">
          <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-red-500 break-all">
            {{ row.original.targetUrl }}
          </code>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-pencil-square"
              size="xs"
              variant="ghost"
              color="neutral"
              :to="toEditPath(row.original.sourcePath)"
              title="編集して修正"
            />
          </div>
        </template>

        <template #empty>
          <div class="flex flex-col items-center justify-center py-12">
            <template v-if="!pending">
              <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-500 mb-4" />
              <p class="text-gray-500">リンク切れは見つかりませんでした！素晴らしい！</p>
            </template>
          </div>
        </template>
      </UTable>
    </UCard>

    <div
      v-else-if="!pending"
      class="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl"
    >
      <UIcon name="i-heroicons-link-slash" class="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
      <p class="text-gray-400 font-medium">「スキャンを開始」ボタンを押してリンク切れを確認してください</p>
    </div>
  </div>
</template>
