<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

const props = defineProps<{
  modelValue: string
  textarea?: ComponentPublicInstance | HTMLTextAreaElement | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const getTextArea = () => {
  if (!props.textarea) return null
  // Nuxt UI UTextarea wraps the actual textarea in a div
  if (props.textarea instanceof HTMLElement) {
    return props.textarea as HTMLTextAreaElement
  }
  // If it's a Vue component instance, it has $el
  const el = (props.textarea as ComponentPublicInstance).$el
  if (el) {
    return (el as HTMLElement).querySelector('textarea') as HTMLTextAreaElement | null
  }
  return null
}

const wrapSelection = (before: string, after: string) => {
  const el = getTextArea()
  if (!el) return

  const start = el.selectionStart
  const end = el.selectionEnd
  const fullText = props.modelValue
  const selection = fullText.substring(start, end)

  const newValue = fullText.substring(0, start) + before + selection + after + fullText.substring(end)
  emit('update:modelValue', newValue)

  nextTick(() => {
    el.focus()
    if (start === end) {
      // No selection, place cursor between tags
      const pos = start + before.length
      el.setSelectionRange(pos, pos)
    } else {
      // Maintain selection or move to end
      const pos = start + before.length + selection.length + after.length
      el.setSelectionRange(pos, pos)
    }
  })
}

const addPrefix = (prefix: string) => {
  const el = getTextArea()
  if (!el) return

  const start = el.selectionStart
  const fullText = props.modelValue

  // Find start of line
  const beforeText = fullText.substring(0, start)
  const lineStart = beforeText.lastIndexOf('\n') + 1

  const newValue = fullText.substring(0, lineStart) + prefix + fullText.substring(lineStart)
  emit('update:modelValue', newValue)

  nextTick(() => {
    el.focus()
    const pos = start + prefix.length
    el.setSelectionRange(pos, pos)
  })
}

const insertLink = () => {
  wrapSelection('[', '](url)')
}

const items = [
  { label: '太', action: () => wrapSelection('**', '**'), tooltip: '太字', style: 'font-bold' },
  { label: '斜', action: () => wrapSelection('*', '*'), tooltip: '斜体', style: 'italic' },
  { label: '消', action: () => wrapSelection('~~', '~~'), tooltip: '取り消し線', style: 'line-through' },
  { icon: 'i-heroicons-hashtag', action: () => addPrefix('## '), tooltip: '見出し' },
  { icon: 'i-heroicons-list-bullet', action: () => addPrefix('- '), tooltip: 'リスト' },
  { icon: 'i-heroicons-link', action: () => insertLink(), tooltip: 'リンク' },
  { icon: 'i-heroicons-code-bracket', action: () => wrapSelection('`', '`'), tooltip: 'コード' },
  { icon: 'i-heroicons-chat-bubble-bottom-center-text', action: () => addPrefix('> '), tooltip: '引用' }
]
</script>

<template>
  <div
    class="markdown-toolbar flex items-center gap-0.5 p-1 bg-gray-50 dark:bg-gray-800/50 border border-default rounded-t-lg border-b-0 overflow-x-auto no-scrollbar"
  >
    <template v-for="(item, index) in items" :key="index">
      <u-tooltip :text="item.tooltip" :delay-duration="500">
        <u-button
          variant="ghost"
          color="neutral"
          size="xs"
          class="h-8 w-8 flex items-center justify-center"
          :icon="item.icon"
          @click="item.action"
        >
          <span v-if="item.label && !item.icon" class="text-xs" :class="item.style">{{ item.label }}</span>
        </u-button>
      </u-tooltip>
    </template>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
