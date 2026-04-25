<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

const props = defineProps<{
  href?: string
  legacyHref?: string
}>()

const linkClass = [
  'text-primary border-b border-transparent hover:border-primary font-medium focus-visible:outline-primary',
  'focus-visible:has-[>code]:outline-0 [&>code]:border-dashed hover:[&>code]:border-primary hover:[&>code]:text-primary',
  'focus-visible:[&>code]:border-primary focus-visible:[&>code]:text-primary transition-colors [&>code]:transition-colors'
]
const resolvedHref = computed(() => props.legacyHref || props.href || '')
// const isInternal = computed(() => resolvedHref.value.startsWith('/'))
</script>

<template>
  <NuxtLink :to="resolvedHref" :class="linkClass" v-bind="$attrs">
    <slot />
  </NuxtLink>
</template>
