<script setup lang="ts">
import type { Comment } from '~/types'

const props = defineProps<{
  comment: Comment
  path: string
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const { user } = useUserSession()

const replyBody = ref('')
const isReplying = ref(false)
const isReplyingOpen = ref(false)

const editBody = ref(props.comment.body)
const isEditing = ref(false)
const isEditingOpen = ref(false)

const openReply = () => {
  isReplyingOpen.value = true
  replyBody.value = ''
  isEditingOpen.value = false
}

const openEdit = () => {
  isEditingOpen.value = true
  editBody.value = props.comment.body
  isReplyingOpen.value = false
}

const submitReply = async () => {
  if (!replyBody.value.trim() || !user.value) return
  isReplying.value = true
  try {
    await $fetch('/api/comment', {
      method: 'POST',
      body: {
        path: props.path,
        body: replyBody.value,
        replyTo: props.comment.id
      }
    })
    isReplyingOpen.value = false
    replyBody.value = ''
    emit('refresh')
  } catch (error) {
    console.error(error)
    alert('返信の送信に失敗しました')
  } finally {
    isReplying.value = false
  }
}

const submitEdit = async () => {
  if (!editBody.value.trim() || !user.value) return
  isEditing.value = true
  try {
    await $fetch('/api/comment', {
      method: 'PUT',
      body: {
        id: props.comment.id,
        body: editBody.value
      }
    })
    isEditingOpen.value = false
    emit('refresh')
  } catch (error) {
    console.error(error)
    alert('コメントの更新に失敗しました')
  } finally {
    isEditing.value = false
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/30 border border-default shadow-sm relative">
    <div class="flex justify-between items-center text-sm text-muted mb-3">
      <span class="font-medium text-foreground flex items-center gap-2">
        <u-avatar size="xs" :alt="comment.profiles?.name || '名無しさん'" />
        {{ comment.profiles?.name || '名無しさん' }}
      </span>
      <span>
        {{ formatDate(comment.createdAt) }}
        <span v-if="comment.updatedAt && comment.updatedAt !== comment.createdAt" class="text-xs ml-1">(編集済)</span>
      </span>
    </div>

    <!-- 編集モード -->
    <div v-if="isEditingOpen" class="mt-2">
      <u-textarea v-model="editBody" :rows="3" class="w-full" />
      <div v-if="editBody.trim()" class="mt-3 p-3 border border-default rounded bg-white dark:bg-gray-900/50">
        <div class="text-xs text-muted mb-2 font-medium flex items-center gap-1">
          <u-icon name="i-heroicons-eye" class="w-3.5 h-3.5" />プレビュー
        </div>
        <MDC :value="editBody" class="prose prose-sm dark:prose-invert max-w-none" />
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <u-button size="sm" color="neutral" variant="ghost" @click="isEditingOpen = false">キャンセル</u-button>
        <u-button size="sm" color="primary" :loading="isEditing" @click="submitEdit">更新</u-button>
      </div>
    </div>
    <!-- 通常表示 -->
    <div v-else class="text-foreground leading-relaxed">
      <div v-if="comment.replyToName" class="text-primary font-medium text-xs mb-1">
        <u-icon name="i-heroicons-arrow-uturn-right" class="w-3 h-3 inline-block mr-0.5 align-text-bottom" />
        宛先: {{ comment.replyToName }}
      </div>
      <MDC :value="comment.body" class="prose prose-sm dark:prose-invert max-w-none" />
    </div>

    <!-- アクションボタン群 -->
    <div v-if="user && !isEditingOpen" class="flex justify-end gap-3 mt-3 text-sm">
      <!-- ユーザーIDチェック -->
      <button
        v-if="comment.userId === user.id"
        class="text-muted hover:text-primary transition-colors flex items-center gap-1"
        @click="openEdit"
      >
        <u-icon name="i-heroicons-pencil-square" class="w-4 h-4" /> 編集
      </button>
      <button class="text-muted hover:text-primary transition-colors flex items-center gap-1" @click="openReply">
        <u-icon name="i-heroicons-arrow-uturn-left" class="w-4 h-4" /> 返信
      </button>
    </div>

    <!-- 返信フォーム -->
    <div v-if="isReplyingOpen" class="mt-4 pl-4 border-l-2 border-primary">
      <u-textarea v-model="replyBody" placeholder="Markdownで返信を入力..." :rows="3" class="w-full" />
      <div v-if="replyBody.trim()" class="mt-3 p-3 border border-default rounded bg-white dark:bg-gray-900/50">
        <div class="text-xs text-muted mb-2 font-medium flex items-center gap-1">
          <u-icon name="i-heroicons-eye" class="w-3.5 h-3.5" />プレビュー
        </div>
        <MDC :value="replyBody" class="prose prose-sm dark:prose-invert max-w-none" />
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <u-button size="sm" color="neutral" variant="ghost" @click="isReplyingOpen = false">キャンセル</u-button>
        <u-button size="sm" :loading="isReplying" @click="submitReply">返信を送信</u-button>
      </div>
    </div>

    <!-- 子コメント（再帰呼び出し） -->
    <div
      v-if="comment.children && comment.children.length > 0"
      class="mt-5 pl-4 sm:pl-6 border-l-2 border-gray-200 dark:border-gray-700 flex flex-col gap-4"
    >
      <DiscussionComment
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :path="path"
        @refresh="emit('refresh')"
      />
    </div>
  </div>
</template>
