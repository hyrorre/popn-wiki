<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { Comment } from '~/shared/types'

const props = defineProps<{
  path: string
  discussionTitle?: string
}>()

type CommentLayout = 'thread' | 'flat'
type ThreadedComment = Omit<Comment, 'children'> & { children: ThreadedComment[] }
type FlatCommentThread = {
  root: Comment
  replies: Comment[]
}
type CommentListResponse = { comments: Comment[]; total: number }

const { user } = useUserSession()

const page = ref(1)
const itemsPerPage = 20
const commentLayout = ref<CommentLayout>('thread')
const collapsedThreadIds = ref(new Set<number>())

const commentLayoutOptions: { label: string; value: CommentLayout; icon: string }[] = [
  { label: 'ツリー', value: 'thread', icon: 'i-lucide-list-tree' },
  { label: 'フラット', value: 'flat', icon: 'i-lucide-align-justify' }
]

// APIリクエストでpathを指定してコメントを取得します
const { data: commentData } = await useFetch<CommentListResponse>('/api/comment', {
  query: {
    path: props.path,
    page,
    limit: itemsPerPage
  }
})

const refreshComments = async () => {
  commentData.value = await $fetch<CommentListResponse>('/api/comment', {
    query: {
      path: props.path,
      page: page.value,
      limit: itemsPerPage,
      fresh: Date.now().toString()
    }
  })
}

const refreshCommentsAfterMutation = async () => {
  try {
    await refreshComments()
  } catch (error) {
    console.error(error)
    alert('コメントの変更は完了しましたが、一覧の更新に失敗しました。再読み込みしてください。')
  }
}

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
    await refreshCommentsAfterMutation()
  } catch (error) {
    console.error(error)
    alert('コメントの送信に失敗しました')
  } finally {
    isSubmitting.value = false
  }
}

const commentMap = computed(() => new Map(comments.value.map((comment) => [comment.id, comment])))

const compareCommentsAsc = (a: Comment, b: Comment) => {
  const createdAtDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  return createdAtDiff === 0 ? a.id - b.id : createdAtDiff
}

const resolveRootId = (comment: Comment) => {
  let current = comment
  const visitedIds = new Set<number>()

  while (current.replyTo && commentMap.value.has(current.replyTo) && !visitedIds.has(current.id)) {
    visitedIds.add(current.id)
    current = commentMap.value.get(current.replyTo)!
  }

  return current.id
}

const countReplies = (comment: ThreadedComment): number => {
  return comment.children.reduce((total, child) => total + 1 + countReplies(child), 0)
}

const isThreadCollapsed = (threadId: number) => collapsedThreadIds.value.has(threadId)

const toggleThread = (threadId: number) => {
  const nextCollapsedThreadIds = new Set(collapsedThreadIds.value)

  if (nextCollapsedThreadIds.has(threadId)) {
    nextCollapsedThreadIds.delete(threadId)
  } else {
    nextCollapsedThreadIds.add(threadId)
  }

  collapsedThreadIds.value = nextCollapsedThreadIds
}

// Flatなコメント一覧を、親コメントと子コメント（返信）のツリー構造に変換
const threadedComments = computed(() => {
  if (!comments.value) return []
  const map = new Map<number, ThreadedComment>()
  const roots: ThreadedComment[] = []

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

const flatCommentThreads = computed<FlatCommentThread[]>(() => {
  const threads = new Map<number, FlatCommentThread>()

  comments.value.forEach((comment) => {
    if (!comment.replyTo) {
      threads.set(comment.id, { root: comment, replies: [] })
    }
  })

  comments.value.forEach((comment) => {
    if (!comment.replyTo) return

    const rootId = resolveRootId(comment)
    const root = commentMap.value.get(rootId)

    if (!root) return

    if (!threads.has(rootId)) {
      threads.set(rootId, { root, replies: [] })
    }

    threads.get(rootId)?.replies.push(comment)
  })

  return [...threads.values()].map((thread) => ({
    root: thread.root,
    replies: [...thread.replies].sort(compareCommentsAsc)
  }))
})

// ページ遷移時に上部にスクロール
watch(page, (newVal) => {
  jumpPage.value = newVal
  const element = document.getElementById('discussion')
  if (element) {
    element.scrollIntoView()
  }
})
</script>

<template>
  <div id="discussion" class="discussion-container">
    <h3 class="text-xl font-bold mb-6 flex items-center gap-2">
      <u-icon name="i-lucide-messages-square" class="w-6 h-6" />
      {{ props.discussionTitle || 'コメント' }}
    </h3>

    <div v-if="!comments.length" class="text-muted mb-6">コメントはまだありません。</div>

    <div v-else-if="false" class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="text-sm text-muted">
        表示形式:
        <span class="font-medium text-foreground">
          {{ commentLayout === 'thread' ? '返信をネスト表示' : '返信をスレッドごとに古い順で表示' }}
        </span>
      </div>
      <div
        class="grid w-full grid-cols-2 rounded-lg border border-default bg-white p-1 shadow-sm dark:bg-gray-900 sm:w-auto"
      >
        <u-button
          v-for="option in commentLayoutOptions"
          :key="option.value"
          :icon="option.icon"
          size="sm"
          class="min-w-0 justify-center"
          :color="commentLayout === option.value ? 'primary' : 'neutral'"
          :variant="commentLayout === option.value ? 'solid' : 'ghost'"
          @click="commentLayout = option.value"
        >
          {{ option.label }}
        </u-button>
      </div>
    </div>

    <div v-if="commentLayout === 'thread'" class="flex flex-col gap-6 mb-8">
      <!-- 親コメントループ & 再帰コンポーネントへ移譲 -->
      <section v-for="comment in threadedComments" :key="comment.id" class="flex flex-col gap-4">
        <DiscussionComment
          :comment="comment"
          :path="path"
          :show-children="false"
          :show-reply-target="false"
          @refresh="refreshCommentsAfterMutation"
        />

        <div
          v-if="comment.children.length"
          class="flex flex-col gap-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700 sm:pl-6"
        >
          <div v-if="false">
            <u-button
              :icon="isThreadCollapsed(comment.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="toggleThread(comment.id)"
            >
              {{ isThreadCollapsed(comment.id) ? '返信を表示' : '返信を折りたたむ' }}（{{ countReplies(comment) }}件）
            </u-button>
          </div>

          <template v-if="!isThreadCollapsed(comment.id)">
            <DiscussionComment
              v-for="child in comment.children"
              :key="child.id"
              :comment="child"
              :path="path"
              :show-reply-target="false"
              @refresh="refreshCommentsAfterMutation"
            />
          </template>
        </div>
      </section>
    </div>

    <div v-else class="flex flex-col gap-6 mb-8">
      <section v-for="thread in flatCommentThreads" :key="thread.root.id" class="flex flex-col gap-4">
        <DiscussionComment
          :comment="thread.root"
          :path="path"
          :show-children="false"
          :show-reply-target="false"
          @refresh="refreshCommentsAfterMutation"
        />

        <div
          v-if="thread.replies.length"
          class="ml-0 flex flex-col gap-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700 sm:ml-4 sm:pl-5"
        >
          <div>
            <u-button
              :icon="isThreadCollapsed(thread.root.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="toggleThread(thread.root.id)"
            >
              {{ isThreadCollapsed(thread.root.id) ? '返信を表示' : '返信を折りたたむ' }}（{{
                thread.replies.length
              }}件）
            </u-button>
          </div>

          <template v-if="!isThreadCollapsed(thread.root.id)">
            <DiscussionComment
              v-for="reply in thread.replies"
              :key="reply.id"
              :comment="reply"
              :path="path"
              :show-children="false"
              :show-reply-target="reply.replyTo !== thread.root.id"
              @refresh="refreshCommentsAfterMutation"
            />
          </template>
        </div>
      </section>
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
    <div
      v-else
      class="text-sm text-muted bg-gray-50 dark:bg-gray-800/50 border border-default p-4 rounded-md text-center"
    >
      コメントを投稿するにはログインしてください。
    </div>
  </div>
</template>
