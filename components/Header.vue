<script setup lang="ts">
const props = withDefaults(defineProps<{ showButtons?: boolean }>(), {
  showButtons: true
})

const { setSidebarOpen } = usePageActions()
const { items } = useNavigation(props.showButtons)
</script>

<template>
  <header class="border-b border-default mb-8">
    <u-container class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <u-button
          v-if="props.showButtons"
          icon="i-heroicons-bars-3"
          variant="ghost"
          color="neutral"
          class="lg:hidden"
          @click="setSidebarOpen(true)"
        />
        <u-navigation-menu v-if="items[0]" :items="items[0]" />
      </div>
      <div class="hidden lg:flex items-center gap-2">
        <u-navigation-menu
          v-if="items[1] && items[2]"
          :items="[...items[1], ...items[2]]"
          content-orientation="vertical"
        />
      </div>
    </u-container>
  </header>
</template>
