import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SafeMarkdown from '../../components/SafeMarkdown.vue'

describe('Markdown previews', () => {
  test('ignores frontmatter renderer overrides while rendering the body', async () => {
    const wrapper = await mountSuspended(SafeMarkdown, {
      props: {
        value: [
          '---',
          'component:',
          '  name: div',
          '  props:',
          '    innerHTML: "<b>injected</b>"',
          'mdc:',
          '  components:',
          '    p: iframe',
          '---',
          'Normal body'
        ].join('\n')
      }
    })
    expect(wrapper.text()).toContain('Normal body')
    expect(wrapper.text()).not.toContain('injected')
    expect(wrapper.find('iframe').exists()).toBe(false)
    wrapper.unmount()
  })
})
