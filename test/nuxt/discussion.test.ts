import { describe, expect, test, vi } from 'vitest'
import { getQuery } from 'h3'
import { defineComponent } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import Discussion from '../../components/Discussion.vue'

const root = { id: 1, body: 'root', replyTo: null, createdAt: '2026-01-01' }
const child = { id: 2, body: 'child', replyTo: 1, createdAt: '2026-01-02' }
const deep = { id: 3, body: 'deep reply', replyTo: 2, createdAt: '2026-01-03' }

// Renders nested replies like DiscussionComment, so the thread layout shows every loaded comment.
const DiscussionCommentStub = defineComponent({
  name: 'DiscussionComment',
  props: {
    comment: { type: Object, required: true },
    showChildren: { type: Boolean, default: true }
  },
  template: `<div>
    <p class="review-comment">{{ comment.body }}</p>
    <template v-if="showChildren">
      <DiscussionComment v-for="reply in comment.children ?? []" :key="reply.id" :comment="reply" />
    </template>
  </div>`
})

const stubs = { DiscussionComment: DiscussionCommentStub, SafeMarkdown: true, MarkdownToolbar: true }

describe('Discussion continuations', () => {
  test('loads omitted replies without duplicating the boundary comment', async () => {
    let requestedThread: unknown
    const unregister = registerEndpoint('/api/comment', {
      handler: (event) => {
        const { threadId } = getQuery(event)
        if (threadId) {
          requestedThread = threadId
          return { comments: [child, deep], total: 1, continuationIds: [], truncated: false }
        }
        return { comments: [root, child], total: 1, continuationIds: [2], truncated: true }
      }
    })
    try {
      const wrapper = await mountSuspended(Discussion, {
        props: { path: 'discussion-test' },
        global: { stubs }
      })
      const loadButton = wrapper.findAll('button').find((button) => button.text() === '続きの返信を読み込む')!
      await loadButton.trigger('click')
      await vi.waitFor(() => expect(requestedThread).toBe('2'))
      await vi.waitFor(() => expect(wrapper.findAll('.review-comment')).toHaveLength(3))
      expect(wrapper.text()).toContain('deep reply')
      expect(wrapper.text()).not.toContain('続きの返信を読み込む')
      wrapper.unmount()
    } finally {
      unregister()
    }
  })
})

describe('Discussion controls', () => {
  test('keeps the layout toggle and reply collapsing hidden', async () => {
    const unregister = registerEndpoint('/api/comment', {
      handler: () => ({ comments: [root, child], total: 1, continuationIds: [], truncated: false })
    })
    try {
      const wrapper = await mountSuspended(Discussion, {
        props: { path: 'discussion-controls' },
        global: { stubs }
      })
      await vi.waitFor(() => expect(wrapper.findAll('.review-comment')).toHaveLength(2))
      expect(wrapper.text()).not.toContain('表示形式')
      expect(wrapper.text()).not.toContain('返信を折りたたむ')
      expect(wrapper.findAll('button').map((button) => button.text())).not.toContain('フラット')
      wrapper.unmount()
    } finally {
      unregister()
    }
  })
})
