<script setup lang="ts">
type SearchResult = {
  path: string
  title: string
  revision: number
  updatedAt: string
  matchTypes: Array<'title' | 'path' | 'body'>
  snippet: string
  snippetType: 'title' | 'path' | 'body'
  score: number
}

type SearchResponse = {
  query: string
  page: number
  limit: number
  total: number
  items: SearchResult[]
}

type CommentSearchResult = {
  id: number
  path: string
  pageTitle: string
  body: string
  snippet: string
  createdAt: string
  updatedAt: string
  userName: string | null
}

type CommentSearchResponse = {
  query: string
  page: number
  limit: number
  total: number
  items: CommentSearchResult[]
}

type SearchTab = 'pages' | 'comments'

const route = useRoute()
const router = useRouter()

const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const activeTab = computed<SearchTab>({
  get: () => (route.query.type === 'comments' ? 'comments' : 'pages'),
  set: async (value) => {
    await router.push({
      path: '/search',
      query: {
        q: query.value,
        ...(value === 'comments' ? { type: 'comments' } : {})
      }
    })
  }
})
const page = computed({
  get: () => {
    const value = Number.parseInt(typeof route.query.page === 'string' ? route.query.page : '1', 10)
    return Number.isInteger(value) && value > 0 ? value : 1
  },
  set: async (value: number) => {
    await router.push({
      path: '/search',
      query: {
        q: query.value,
        ...(activeTab.value === 'comments' ? { type: 'comments' } : {}),
        ...(value > 1 ? { page: String(value) } : {})
      }
    })
  }
})
const canSearch = computed(() => query.value.length >= 2)

const emptyResponse = computed<SearchResponse>(() => ({
  query: query.value,
  page: page.value,
  limit: 20,
  total: 0,
  items: []
}))

const emptyCommentResponse = computed<CommentSearchResponse>(() => ({
  query: query.value,
  page: page.value,
  limit: 20,
  total: 0,
  items: []
}))

const searchTabs = [
  { label: 'ページ', value: 'pages', icon: 'i-lucide-file-text' },
  { label: 'コメント', value: 'comments', icon: 'i-lucide-messages-square' }
]

const { data: pageData, status: pageStatus } = await useAsyncData<SearchResponse>(
  async () => {
    if (!canSearch.value || activeTab.value !== 'pages') {
      return emptyResponse.value
    }

    return $fetch<SearchResponse>('/api/search' as string, {
      query: {
        q: query.value,
        page: page.value,
        limit: 20
      }
    })
  },
  {
    watch: [query, page, activeTab],
    default: () => emptyResponse.value
  }
)

const { data: commentData, status: commentStatus } = await useAsyncData<CommentSearchResponse>(
  async () => {
    if (!canSearch.value || activeTab.value !== 'comments') {
      return emptyCommentResponse.value
    }

    return $fetch<CommentSearchResponse>('/api/comment/search' as string, {
      query: {
        q: query.value,
        page: page.value,
        limit: 20
      }
    })
  },
  {
    watch: [query, page, activeTab],
    default: () => emptyCommentResponse.value
  }
)

const activeData = computed(() => (activeTab.value === 'comments' ? commentData.value : pageData.value))
const activeStatus = computed(() => (activeTab.value === 'comments' ? commentStatus.value : pageStatus.value))

const totalPages = computed(() => {
  if (!activeData.value || activeData.value.total === 0) {
    return 1
  }

  return Math.ceil(activeData.value.total / activeData.value.limit)
})

const resultLabel = computed(() => {
  if (!canSearch.value) {
    return '2文字以上で検索してください。'
  }

  if (!activeData.value) {
    return ''
  }

  const target = activeTab.value === 'comments' ? 'コメント' : 'ページ'
  return `「${activeData.value.query}」の${target}検索結果 ${activeData.value.total}件`
})

useHead(() => ({
  title: query.value ? `検索: ${query.value}` : '検索'
}))

function pageHref(path: string) {
  return path === '/' ? '/' : `/${path}`
}

function badgeLabel(type: SearchResult['matchTypes'][number]) {
  switch (type) {
    case 'title':
      return 'タイトル一致'
    case 'path':
      return 'パス一致'
    case 'body':
      return '本文一致'
  }
}

function badgeColor(type: SearchResult['matchTypes'][number]) {
  switch (type) {
    case 'title':
      return 'primary'
    case 'path':
      return 'info'
    case 'body':
      return 'neutral'
  }
}

function highlightSnippet(snippet: string) {
  const terms = query.value
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  if (terms.length === 0) {
    return [{ text: snippet, matched: false }]
  }

  const pattern = new RegExp(`(${terms.map((term) => escapeRegExp(term)).join('|')})`, 'gi')
  return snippet
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      matched: terms.some((term) => part.toLocaleLowerCase('ja-JP') === term.toLocaleLowerCase('ja-JP'))
    }))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
</script>

<template>
  <Header :show-buttons="false" />

  <u-container class="py-8">
    <div class="mb-8 flex flex-col gap-4">
      <div>
        <h1 class="text-3xl font-bold">検索</h1>
        <p class="mt-2 text-muted">{{ resultLabel }}</p>
      </div>
      <SearchForm autofocus size="lg" placeholder="検索語を入力" />
    </div>

    <u-tabs v-model="activeTab" :items="searchTabs" class="mb-6" />

    <div v-if="activeStatus === 'pending'" class="flex justify-center py-20">
      <u-icon name="i-lucide-refresh-cw" class="h-10 w-10 animate-spin text-muted" />
    </div>

    <div
      v-else-if="!canSearch"
      class="rounded-2xl border border-dashed border-default bg-gray-50 py-20 text-center dark:bg-gray-800/50"
    >
      <p class="font-medium text-muted">検索語を入力してください。</p>
    </div>

    <div
      v-else-if="activeData && activeData.items.length === 0"
      class="rounded-2xl border border-dashed border-default bg-gray-50 py-20 text-center dark:bg-gray-800/50"
    >
      <p class="font-medium text-muted">
        該当する{{ activeTab === 'comments' ? 'コメント' : 'ページ' }}は見つかりませんでした。
      </p>
    </div>

    <div v-else-if="activeTab === 'pages' && pageData" class="flex flex-col gap-4">
      <NuxtLink
        v-for="item in pageData.items"
        :key="item.path"
        :to="pageHref(item.path)"
        class="block rounded-xl border border-default bg-gray-50/60 p-5 transition hover:border-primary/40 hover:bg-white dark:bg-gray-800/30 dark:hover:bg-gray-900/60"
      >
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
              <h2 class="truncate text-xl font-semibold text-foreground">
                {{ item.title }}
              </h2>
              <p class="mt-1 truncate text-sm text-muted">{{ item.path }}</p>
            </div>
            <p class="shrink-0 text-sm text-muted">
              {{ formatDate(item.updatedAt) }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <u-badge v-for="type in item.matchTypes" :key="type" :color="badgeColor(type)" variant="soft">
              {{ badgeLabel(type) }}
            </u-badge>
          </div>

          <p class="whitespace-pre-wrap wrap-break-word text-sm leading-7 text-foreground/90">
            <template v-for="(part, index) in highlightSnippet(item.snippet)" :key="`${item.path}-${index}`">
              <mark v-if="part.matched">{{ part.text }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </p>
        </div>
      </NuxtLink>

      <div class="flex justify-center pt-4">
        <u-pagination
          v-if="totalPages > 1"
          v-model:page="page"
          :total="pageData.total"
          :items-per-page="pageData.limit"
          size="md"
          color="primary"
        />
      </div>
    </div>

    <div v-else-if="activeTab === 'comments' && commentData" class="flex flex-col gap-4">
      <NuxtLink
        v-for="item in commentData.items"
        :key="item.id"
        :to="`${pageHref(item.path)}#comment-${item.id}`"
        class="block rounded-xl border border-default bg-gray-50/60 p-5 transition hover:border-primary/40 hover:bg-white dark:bg-gray-800/30 dark:hover:bg-gray-900/60"
      >
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
              <h2 class="truncate text-xl font-semibold text-foreground">
                {{ item.pageTitle }}
              </h2>
              <p class="mt-1 truncate text-sm text-muted">{{ item.path }}</p>
            </div>
            <p class="shrink-0 text-sm text-muted">
              {{ formatDate(item.createdAt) }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
            <u-badge color="warning" variant="soft">コメント一致</u-badge>
            <span>{{ item.userName || '名無しさん' }}</span>
          </div>

          <p class="whitespace-pre-wrap wrap-break-word text-sm leading-7 text-foreground/90">
            <template v-for="(part, index) in highlightSnippet(item.snippet)" :key="`${item.id}-${index}`">
              <mark v-if="part.matched">{{ part.text }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </p>
        </div>
      </NuxtLink>

      <div class="flex justify-center pt-4">
        <u-pagination
          v-if="totalPages > 1"
          v-model:page="page"
          :total="commentData.total"
          :items-per-page="commentData.limit"
          size="md"
          color="primary"
        />
      </div>
    </div>
  </u-container>

  <Footer />
</template>
