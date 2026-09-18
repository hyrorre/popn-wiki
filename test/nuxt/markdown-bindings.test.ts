import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { MDCRenderer } from '#components'
import SafeMarkdown from '../../components/SafeMarkdown.vue'
import { parseSafeMarkdown } from '../../server/utils/markdown'

const value = '---\nlabel: "<img src=x onerror=example()>"\ncount: 42\n---\n{{ label }} / {{ count }}'
describe('rendered text bindings', () => {
  for (const mode of ['preview', 'stored'] as const) {
    test(`renders metadata as inert text in ${mode}`, async () => {
      const { ast } = await parseSafeMarkdown(value)
      const wrapper =
        mode === 'preview'
          ? await mountSuspended(SafeMarkdown, { props: { value } })
          : await mountSuspended(MDCRenderer, { props: { body: ast.body, data: ast.data } })
      expect(wrapper.text()).toContain('<img src=x onerror=example()> / 42')
      expect(wrapper.find('img').exists()).toBe(false)
      wrapper.unmount()
    })
  }
})
