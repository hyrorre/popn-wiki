<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { Comment } from '~/shared/types'

const props = defineProps<{
  path: string
}>()

const { user } = useUserSession()

const page = ref(1)
const itemsPerPage = 20

// APIリクエストでpathを指定してコメントを取得します
const { data: commentData, refresh } = await useFetch<{ comments: Comment[]; total: number }>('/api/comment', {
  query: {
    path: props.path,
    page,
    limit: itemsPerPage
  }
})

const comments = computed(() => commentData.value?.comments || [])
const totalRoots = computed(() => commentData.value?.total || 0)
const maxPage = computed(() => Math.ceil(totalRoots.value / itemsPerPage))

const jumpPage = ref(1)

const handleJump = () => {
  const p = parseInt(jumpPage.value.toString())
  if (!isNaN(p) && p >= 1 && p <= maxPage.value) {
    page.value = p
  } else {
    jumpPage.value = page.value
  }
}

const newCommentBody = ref('')
const textareaRef = ref<ComponentPublicInstance | null>(null)
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
  const map = new Map<number, Comment & { children: Comment[] }>()
  const roots: Comment[] = []

  // マップに事前にセット
  comments.value.forEach((c) => {
    map.set(c.id, { ...c, children: [] })
  })

  // 親子関係を構築
  comments.value.forEach((c) => {
    if (c.replyTo && map.has(c.replyTo)) {
      map.get(c.replyTo)?.children.push(map.get(c.id)!)
    } else {
      const root = map.get(c.id)
      if (root) roots.push(root)
    }
  })

  return roots
})

// ページ遷移時に上部にスクロール
watch(page, (newVal) => {
  jumpPage.value = newVal
  const element = document.getElementById('discussion')
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
})
</script>

<template>
  <div id="discussion" class="discussion-container">
    <h3 class="text-xl font-bold mb-6 flex items-center gap-2">
      <u-icon name="i-lucide-messages-square" class="w-6 h-6" />
      コメント
    </h3>

    <div v-if="!comments.length" class="text-muted mb-6">コメントはまだありません。</div>

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

    <!-- ページネーション & ジャンプ -->
    <div
      v-if="totalRoots > itemsPerPage"
      class="flex flex-col md:flex-row items-center justify-center gap-5 mb-8 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-default"
    >
      <div class="text-sm font-medium text-muted">
        全 <span class="text-foreground">{{ maxPage }}</span> ページ
      </div>

      <u-pagination v-model:page="page" :total="totalRoots" :items-per-page="itemsPerPage" size="md" color="primary" />

      <div class="flex items-center gap-2">
        <u-input
          v-model="jumpPage"
          type="number"
          size="sm"
          class="w-16"
          :min="1"
          :max="maxPage"
          @keyup.enter="handleJump"
        />
        <span class="text-xs text-muted font-medium">ページへ</span>
        <u-button size="xs" color="neutral" variant="ghost" icon="i-lucide-search" @click="handleJump" />
      </div>
    </div>

    <div v-if="user" class="border border-default rounded-lg p-5 bg-white dark:bg-gray-900 shadow-sm">
      <h4 class="font-bold mb-3 flex items-center gap-2">
        <u-icon name="i-lucide-square-pen" class="w-5 h-5" />
        新しくコメントする
      </h4>
      <MarkdownToolbar v-model="newCommentBody" :textarea="textareaRef" />
      <u-textarea
        ref="textareaRef"
        v-model="newCommentBody"
        placeholder="ページについての意見や質問を書いてみましょう。"
        :rows="3"
        class="w-full"
        :ui="{ base: 'rounded-t-none' }"
      />

      <!-- プレビュー領域 -->
      <div
        v-if="newCommentBody.trim()"
        class="mt-3 p-3 border border-default rounded bg-gray-50 dark:bg-gray-800/50 transition-all"
      >
        <div class="text-xs text-muted mb-2 font-medium flex items-center gap-1">
          <u-icon name="i-lucide-eye" class="w-3.5 h-3.5" />プレビュー
        </div>
        <MDC :value="newCommentBody" class="prose prose-sm dark:prose-invert max-w-none" />
      </div>

      <div class="flex justify-end mt-3">
        <u-button icon="i-lucide-send" color="primary" :loading="isSubmitting" @click="submitComment"> 送信 </u-button>
      </div>
    </div>
    <div v-else class="text-sm text-muted bg-gray-50 border border-default p-4 rounded-md text-center">
      コメントを投稿するにはログインしてください。
    </div>
  </div>
</template>
