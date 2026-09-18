import { describe, expect, test } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import WikiPage from '../../pages/[...path].vue'
import { sanitizeUnknownMdcMetadata } from '../../utils/markdown-security'

describe('stored page metadata', () => {
  test('keeps discussion and metadata when an old table AST requires fresh rendering', async () => {
    const body = [
      '---',
      'title: Table page',
      'description: Table description',
      'discussion: true',
      'discussion-title: Table discussion',
      'component: iframe',
      '---',
      '| A | B |',
      '| --- | --- |',
      '| Joined | > |'
    ].join('\n')
    const legacy = await parseMarkdown(body)
    const unregister = registerEndpoint('/api/page', {
      handler: () => ({
        path: 'metadata-review',
        title: 'Table page',
        revision: 1,
        body,
        bodyAst: JSON.stringify(legacy)
      })
    })
    try {
      const wrapper = await mountSuspended(WikiPage, {
        route: '/metadata-review',
        global: {
          stubs: {
            Header: true,
            Footer: true,
            Sidebar: true,
            USlideover: true,
            Discussion: { props: ['discussionTitle'], template: '<div data-discussion>{{ discussionTitle }}</div>' }
          }
        }
      })
      expect(wrapper.get('[data-discussion]').text()).toBe('Table discussion')
      expect(wrapper.get('tbody td').attributes('colspan')).toBe('2')
      expect(wrapper.find('iframe').exists()).toBe(false)
      expect(sanitizeUnknownMdcMetadata(legacy)).toMatchObject({
        title: 'Table page',
        description: 'Table description',
        discussion: true
      })
      expect(sanitizeUnknownMdcMetadata(legacy)).not.toHaveProperty('component')
      wrapper.unmount()
    } finally {
      unregister()
    }
  })
})
