<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { Comment } from '~/shared/types'

const props = withDefaults(
  defineProps<{
    comment: Comment
    path: string
    showChildren?: boolean
    showReplyTarget?: boolean
  }>(),
  {
    showChildren: true,
    showReplyTarget: true
  }
)

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
const isDeleting = ref(false)

const replyTextareaRef = ref<ComponentPublicInstance | null>(null)
const editTextareaRef = ref<ComponentPublicInstance | null>(null)

const commentBodyAst = computed(() => {
  if (!props.comment.bodyAst) return null
  try {
    return typeof props.comment.bodyAst === 'string' ? JSON.parse(props.comment.bodyAst) : props.comment.bodyAst
  } catch {
    return null
  }
})

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

const jumpToReplyTarget = () => {
  if (!props.comment.replyTo) return

  const target = document.getElementById(`comment-${props.comment.replyTo}`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

const submitDelete = async () => {
  if (!confirm('このコメントを削除しますか？\n（返信がある場合、それらも非表示になります）')) return
  isDeleting.value = true
  try {
    await $fetch('/api/comment', {
      method: 'DELETE',
      body: {
        id: props.comment.id
      }
    })
    emit('refresh')
  } catch (error) {
    console.error(error)
    alert('コメントの削除に失敗しました')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <CommentPanel
      :id="`comment-${comment.id}`"
      :author-name="comment.profiles?.name || '名無しさん'"
      :author-alt="comment.profiles?.name || '名無しさん'"
      :created-at="comment.createdAt"
      :updated-at="comment.updatedAt"
      class="relative"
    >
      <template v-if="showReplyTarget && comment.replyTo" #headerMeta>
        <div class="flex flex-wrap items-center gap-2">
          <span> >> {{ comment.replyToName || '名無しさん' }} </span>
          <u-button icon="i-lucide-corner-left-up" size="xs" color="neutral" variant="ghost" @click="jumpToReplyTarget">
            返信先へ
          </u-button>
        </div>
      </template>

      <!-- 編集モード -->
      <div v-if="isEditingOpen" class="mt-2 text-foreground">
        <MarkdownToolbar v-model="editBody" :textarea="editTextareaRef" />
        <u-textarea
          ref="editTextareaRef"
          v-model="editBody"
          :rows="3"
          class="w-full"
          :ui="{ base: 'rounded-t-none' }"
        />
        <div v-if="editBody.trim()" class="mt-3 p-3 border border-default rounded bg-white dark:bg-gray-900/50">
          <div class="text-xs text-muted mb-2 font-medium flex items-center gap-1">
            <u-icon name="i-lucide-eye" class="w-3.5 h-3.5" />プレビュー
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
        <MDCRenderer
          v-if="commentBodyAst"
          :body="commentBodyAst.body"
          :data="commentBodyAst.data"
          class="prose prose-sm dark:prose-invert max-w-none"
        />
        <MDC v-else :value="comment.body" class="prose prose-sm dark:prose-invert max-w-none" />
      </div>

      <!-- アクションボタン群 -->
      <div v-if="user && !isEditingOpen" class="flex justify-end gap-3 mt-3 text-sm">
        <!-- ユーザーIDチェック -->
        <button
          v-if="comment.userId === user.id"
          class="text-muted hover:text-primary transition-colors flex items-center gap-1"
          @click="openEdit"
        >
          <u-icon name="i-lucide-square-pen" class="w-4 h-4" /> 編集
        </button>
        <button
          v-if="comment.userId === user.id"
          class="text-muted hover:text-error transition-colors flex items-center gap-1"
          :disabled="isDeleting"
          @click="submitDelete"
        >
          <u-icon name="i-lucide-trash-2" class="w-4 h-4" /> 削除
        </button>
        <button class="text-muted hover:text-primary transition-colors flex items-center gap-1" @click="openReply">
          <u-icon name="i-lucide-undo-2" class="w-4 h-4" /> 返信
        </button>
      </div>

      <!-- 返信フォーム -->
      <div v-if="isReplyingOpen" class="mt-4 pl-4 border-l-2 border-primary">
        <MarkdownToolbar v-model="replyBody" :textarea="replyTextareaRef" />
        <u-textarea
          ref="replyTextareaRef"
          v-model="replyBody"
          placeholder="Markdownで返信を入力..."
          :rows="3"
          class="w-full"
          :ui="{ base: 'rounded-t-none' }"
        />
        <div v-if="replyBody.trim()" class="mt-3 p-3 border border-default rounded bg-white dark:bg-gray-900/50">
          <div class="text-xs text-muted mb-2 font-medium flex items-center gap-1">
            <u-icon name="i-lucide-eye" class="w-3.5 h-3.5" />プレビュー
          </div>
          <MDC :value="replyBody" class="prose prose-sm dark:prose-invert max-w-none" />
        </div>
        <div class="flex justify-end gap-2 mt-2">
          <u-button size="sm" color="neutral" variant="ghost" @click="isReplyingOpen = false">キャンセル</u-button>
          <u-button size="sm" :loading="isReplying" @click="submitReply">返信を送信</u-button>
        </div>
      </div>
    </CommentPanel>

    <!-- 子コメント（再帰呼び出し） -->
    <div
      v-if="showChildren && comment.children && comment.children.length > 0"
      class="flex flex-col gap-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700 sm:pl-6"
    >
      <DiscussionComment
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :path="path"
        :show-children="showChildren"
        :show-reply-target="showReplyTarget"
        @refresh="emit('refresh')"
      />
    </div>
  </div>
</template>
