<script setup lang="ts">
import type { Comment } from '~/types'

const props = defineProps<{
  path: string
}>()

const user = useSupabaseUser()
// APIリクエストでpathを指定してコメントを取得します
const { data: comments, refresh } = await useFetch<Comment[]>('/api/comment', {
  query: { path: props.path }
})

const newCommentBody = ref('')
const isSubmitting = ref(false)

const submitComment = async () => {
  if (!newCommentBody.value.trim() || !user.value) return
  isSubmitting.value = true
  try {
    await $fetch('/api/comment', {
      method: 'POST',
      body: {
        path: props.path,
        body: newCommentBody.value
      }
    })
    newCommentBody.value = ''
    await refresh()
  } catch (error) {
    console.error(error)
    alert('コメントの送信に失敗しました')
  } finally {
    isSubmitting.value = false
  }
}

// Flatなコメント一覧を、親コメントと子コメント（返信）のツリー構造に変換
const threadedComments = computed(() => {
  if (!comments.value) return []
  const map = new Map()
  const roots: any[] = []
  
  // マップに事前にセット
  comments.value.forEach(c => {
    map.set(c.id, { ...c, children: [] })
  })

  // 親子関係を構築
  comments.value.forEach(c => {
    if (c.reply_to && map.has(c.reply_to)) {
      map.get(c.reply_to).children.push(map.get(c.id))
    } else {
      roots.push(map.get(c.id))
    }
  })

  return roots
})
</script>

<template>
  <div class="discussion-container" id="discussion">
    <h3 class="text-xl font-bold mb-6 flex items-center gap-2">
      <u-icon name="i-heroicons-chat-bubble-left-right" class="w-6 h-6" />
      コメント
    </h3>

    <div v-if="!comments?.length" class="text-muted mb-6">
      コメントはまだありません。
    </div>
    
    <div class="flex flex-col gap-6 mb-8">
      <!-- 親コメントループ & 再帰コンポーネントへ移譲 -->
      <DiscussionComment 
        v-for="comment in threadedComments" 
        :key="comment.id" 
        :comment="comment" 
        :path="path" 
        @refresh="refresh" 
      />
    </div>

    <div v-if="user" class="border border-default rounded-lg p-5 bg-white dark:bg-gray-900 shadow-sm">
      <h4 class="font-bold mb-3 flex items-center gap-2">
        <u-icon name="i-heroicons-pencil" class="w-5 h-5" />
        新しくコメントする
      </h4>
      <u-textarea 
        v-model="newCommentBody" 
        placeholder="ページについての意見や質問を書いてみましょう。" 
        :rows="3" 
        class="w-full"
      />

      <!-- プレビュー領域 -->
      <div v-if="newCommentBody.trim()" class="mt-3 p-3 border border-default rounded bg-gray-50 dark:bg-gray-800/50 transition-all">
        <div class="text-xs text-muted mb-2 font-medium flex items-center gap-1">
          <u-icon name="i-heroicons-eye" class="w-3.5 h-3.5" />プレビュー
        </div>
        <MDC :value="newCommentBody" class="prose prose-sm dark:prose-invert max-w-none" />
      </div>

      <div class="flex justify-end mt-3">
        <u-button icon="i-heroicons-paper-airplane" color="primary" :loading="isSubmitting" @click="submitComment">
          送信
        </u-button>
      </div>
    </div>
    <div v-else class="text-sm text-muted bg-gray-50 border border-default p-4 rounded-md text-center">
      コメントを投稿するにはログインしてください。
    </div>
  </div>
</template>
