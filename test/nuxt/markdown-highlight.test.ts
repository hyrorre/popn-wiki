import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { MDCRenderer } from '#components'
import SafeMarkdown from '../../components/SafeMarkdown.vue'
import { parseSafeMarkdown } from '../../server/utils/markdown'
import { sanitizeUnknownMdcDocument } from '../../utils/markdown-security'

const source = '```js\nconst answer = 42\n```'

describe('safe syntax highlighting', () => {
  for (const mode of ['preview', 'stored'] as const) {
    test(`retains Shiki token colors without injecting stylesheets in ${mode}`, async () => {
      const { ast } = await parseSafeMarkdown(source)
      const document = sanitizeUnknownMdcDocument(JSON.parse(JSON.stringify(ast)))!
      const wrapper =
        mode === 'preview'
          ? await mountSuspended(SafeMarkdown, { props: { value: source } })
          : await mountSuspended(MDCRenderer, { props: { body: document.body, data: document.data } })
      const tokens = wrapper.findAll('.shiki span[style]')
      expect(tokens.length).toBeGreaterThan(1)
      for (const token of tokens) {
        for (const theme of ['light', 'default', 'dark']) {
          expect((token.element as HTMLElement).style.getPropertyValue(`--shiki-${theme}`)).toMatch(/^#[\da-f]{6}$/i)
        }
      }
      expect(wrapper.find('style').exists()).toBe(false)
      expect(wrapper.text()).toContain('const answer = 42')
      wrapper.unmount()
    })
  }
})
