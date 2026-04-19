<script setup lang="ts">
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
}

const { data, pending, error, execute } = await useFetch<BrokenLinksResponse>('/api/admin/broken-links', {
  immediate: false,
  server: false
})

const columns = [
  { key: 'sourcePath', label: 'ソースページ' },
  { key: 'type', label: '種類' },
  { key: 'text', label: 'ラベル/URL' },
  { key: 'targetUrl', label: 'リンク切れ先' },
  { key: 'actions', label: '操作' }
]

const rows = computed<BrokenLink[]>(() => data.value?.brokenLinks || [])

const getTypeLabel = (type: BrokenLink['type']) => {
  switch (type) {
    case 'internal': return { label: '内部', color: 'warning' as const }
    case 'image': return { label: '画像', color: 'error' as const }
    case 'external': return { label: '外部', color: 'info' as const }
    default: return { label: type as string, color: 'neutral' as const }
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
      <UButton
        icon="i-heroicons-magnifying-glass"
        size="lg"
        :loading="pending"
        @click="() => execute()"
      >
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

    <UCard v-if="data">
      <template #header>
        <div class="flex items-center gap-4">
          <UBadge color="info" variant="soft">
            チェック済みページ: {{ data.totalChecked }}
          </UBadge>
          <UBadge :color="rows.length > 0 ? 'warning' : 'success'" variant="soft">
            リンク切れ発見: {{ rows.length }}
          </UBadge>
        </div>
      </template>

      <UTable :columns="(columns as any)" :rows="(rows as any)" :loading="pending">
        <template #sourcePath-data="{ row }">
          <ULink :to="(row as any).sourcePath" class="text-primary-500 hover:underline font-medium">
            {{ (row as any).sourcePath }}
          </ULink>
        </template>

        <template #type-data="{ row }">
          <UBadge :color="getTypeLabel((row as any).type).color" variant="soft" size="xs">
            {{ getTypeLabel((row as any).type).label }}
          </UBadge>
        </template>

        <template #text-data="{ row }">
          <span class="text-sm truncate max-w-[200px] block" :title="(row as any).text">
            {{ (row as any).text }}
          </span>
        </template>

        <template #targetUrl-data="{ row }">
          <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-red-500 break-all">
            {{ (row as any).targetUrl }}
          </code>
        </template>

        <template #actions-data="{ row }">
          <div class="flex gap-2">
            <UButton
              icon="i-heroicons-pencil-square"
              size="xs"
              variant="ghost"
              color="neutral"
              :to="`/edit${(row as any).sourcePath}`"
              title="編集して修正"
            />
          </div>
        </template>

        <template #empty-state>
          <div class="flex flex-col items-center justify-center py-12">
            <template v-if="!pending">
              <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-500 mb-4" />
              <p class="text-gray-500">リンク切れは見つかりませんでした！素晴らしい！</p>
            </template>
          </div>
        </template>
      </UTable>
    </UCard>

    <div v-else-if="!pending" class="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
      <UIcon name="i-heroicons-link-slash" class="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
      <p class="text-gray-400 font-medium">「スキャンを開始」ボタンを押してリンク切れを確認してください</p>
    </div>
  </div>
</template>
