<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    authorName?: string | null
    authorAlt?: string
    createdAt: string
    updatedAt?: string | null
    to?: string
    avatarSize?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    authorName: '名無しさん',
    authorAlt: '名無しさん',
    updatedAt: null,
    to: undefined,
    avatarSize: 'xs'
  }
)

const linkComponent = resolveComponent('NuxtLink')

const panelClass = computed(() => [
  'group block rounded-lg border border-default bg-gray-50/50 dark:bg-gray-800/30 shadow-sm',
  'transition-[background-color,border-color,box-shadow] duration-200',
  props.to
    ? 'hover:border-primary/40 hover:bg-white dark:hover:bg-gray-900/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
    : ''
])
</script>

<template>
  <component :is="to ? linkComponent : 'article'" :to="to" class="p-4" :class="panelClass">
    <div class="flex items-start justify-between gap-3 text-sm text-muted">
      <span class="min-w-0 font-medium text-foreground flex items-center gap-2">
        <u-avatar :size="avatarSize" :alt="authorAlt.substring(0, 1)" />
        <span class="truncate">{{ authorName || '名無しさん' }}</span>
      </span>
      <span class="shrink-0 text-right">
        {{ formatDate(createdAt) }}
        <span v-if="updatedAt && updatedAt !== createdAt" class="text-xs ml-1">(編集済)</span>
      </span>
    </div>

    <div v-if="$slots.headerMeta" class="mt-3 text-sm text-muted">
      <slot name="headerMeta" />
    </div>

    <div class="mt-3 text-foreground leading-relaxed">
      <slot />
    </div>

    <div v-if="$slots.footer" class="mt-3">
      <slot name="footer" />
    </div>
  </component>
</template>
