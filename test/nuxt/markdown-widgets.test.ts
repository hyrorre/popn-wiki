import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { MDCRenderer, ProseTabs, ProseTabsItem, ProseCollapsible, ProseBadge } from '#components'
import SafeMarkdown from '../../components/SafeMarkdown.vue'
import { parseSafeMarkdown } from '../../server/utils/markdown'
import { sanitizeUnknownMdcDocument } from '../../utils/markdown-security'

const components = {
  tabs: 'ProseTabs',
  'tabs-item': 'ProseTabsItem',
  collapsible: 'ProseCollapsible',
  badge: 'ProseBadge'
}
const global = { components: { ProseTabs, ProseTabsItem, ProseCollapsible, ProseBadge } }
const source = [
  '::tabs',
  ':::tabs-item{label="First"}',
  'One',
  ':::',
  ':::tabs-item{label="Second"}',
  'Two',
  ':::',
  '::',
  '',
  '::collapsible',
  'Collapsible contents',
  '::',
  '',
  ':badge[New]'
].join('\n')

describe('standard Markdown components', () => {
  for (const mode of ['preview', 'stored'] as const) {
    test(`preserves tab and collapsible controls in ${mode}`, async () => {
      const { ast } = await parseSafeMarkdown(source)
      const document = sanitizeUnknownMdcDocument(JSON.parse(JSON.stringify(ast)))!
      const wrapper =
        mode === 'preview'
          ? await mountSuspended(SafeMarkdown, { props: { value: source }, attrs: { components }, global })
          : await mountSuspended(MDCRenderer, {
              props: { body: document.body, data: document.data, components },
              global
            })
      const tabs = wrapper.findAll('[role="tab"]')
      expect(tabs).toHaveLength(2)
      await tabs[1]!.trigger('keydown', { key: 'Enter' })
      expect(tabs[1]!.attributes('aria-selected')).toBe('true')
      const collapse = wrapper.get('button[aria-expanded]')
      expect(collapse.attributes('aria-expanded')).toBe('false')
      await collapse.trigger('click')
      expect(collapse.attributes('aria-expanded')).toBe('true')
      expect(wrapper.findAll('span').some((span) => span.text() === 'New' && !!span.attributes('class'))).toBe(true)
      wrapper.unmount()
    })
  }
  test('reparses old component output even when it no longer contains its original tags', async () => {
    const { ast } = await parseSafeMarkdown('Already flattened text')
    expect(sanitizeUnknownMdcDocument({ ...ast, renderVersion: undefined })).toBeNull()
    expect(sanitizeUnknownMdcDocument(ast)).not.toBeNull()
  })
})
