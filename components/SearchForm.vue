<script setup lang="ts">
withDefaults(
  defineProps<{
    autofocus?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    placeholder?: string
  }>(),
  {
    autofocus: false,
    size: 'md',
    placeholder: 'ページ・本文・コメントを検索'
  }
)

const route = useRoute()
const router = useRouter()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')

watch(
  () => route.query.q,
  (value) => {
    query.value = typeof value === 'string' ? value : ''
  }
)

const trimmedQuery = computed(() => query.value.trim())
const canSubmit = computed(() => trimmedQuery.value.length >= 2)

async function submitSearch() {
  if (!canSubmit.value) {
    return
  }

  await router.push({
    path: '/search',
    query: { q: trimmedQuery.value }
  })
}
</script>

<template>
  <form class="flex items-center gap-2 w-full" @submit.prevent="submitSearch">
    <u-input
      v-model="query"
      :autofocus="autofocus"
      :size="size"
      :placeholder="placeholder"
      icon="i-lucide-search"
      class="grow"
    />
    <u-button type="submit" color="primary" icon="i-lucide-search" :size="size" :disabled="!canSubmit">
      検索
    </u-button>
  </form>
</template>
