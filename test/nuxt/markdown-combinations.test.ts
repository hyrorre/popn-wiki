import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { MDCRenderer, ProseTabs, ProseTabsItem, ProseCollapsible, ProseCard, ProseBadge } from '#components'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import SafeMarkdown from '../../components/SafeMarkdown.vue'
import ProseA from '../../components/mdc/ProseA.vue'
import { parseSafeMarkdown } from '../../server/utils/markdown'
import { sanitizeUnknownMdcDocument } from '../../utils/markdown-security'
import { mixedMarkdown, nestedMarkdown } from '../fixtures/markdown-combinations'

const components = {
  a: 'ProseA',
  tabs: 'ProseTabs',
  'tabs-item': 'ProseTabsItem',
  collapsible: 'ProseCollapsible',
  card: 'ProseCard',
  badge: 'ProseBadge'
}
const global = { components: { ProseA, ProseTabs, ProseTabsItem, ProseCollapsible, ProseCard, ProseBadge } }

async function render(value: string, mode: 'preview' | 'stored') {
  if (mode === 'preview') return mountSuspended(SafeMarkdown, { props: { value }, attrs: { components }, global })
  const { ast, sanitizedMarkdown } = await parseSafeMarkdown(value)
  expect(sanitizedMarkdown).toBe(value)
  const document = sanitizeUnknownMdcDocument(JSON.parse(JSON.stringify(ast)))!
  // Reading and sanitizing an already sanitized cache must not erode the document.
  expect(document.body).toEqual(ast.body)
  expect(sanitizeUnknownMdcDocument(JSON.parse(JSON.stringify(document)))?.body).toEqual(document.body)
  return mountSuspended(MDCRenderer, { props: { body: document.body, data: document.data, components }, global })
}

function expectMixedTable(wrapper: VueWrapper) {
  const cells = wrapper.findAll('tbody td')
  expect(cells).toHaveLength(9)
  expect(cells[0]!.attributes()).toMatchObject({ colspan: '2', rowspan: '3' })
  expect((cells[0]!.element as HTMLElement).style.backgroundColor).toBe('yellow')
  expect(cells[0]!.get('strong').text()).toBe('結合セル')
  expect(cells[0]!.get('a').attributes('href')).toBe('/guide')
  expect((cells[2]!.get('span').element as HTMLElement).style.color).toBe('red')
  expect(cells[5]!.get('code').text()).toBe('<script>example()</script>')
  expect(cells[8]!.get('ruby rt').text()).toBe('きょく')
  for (const index of [1, 3, 4, 6, 7]) {
    expect((cells[index]!.element as HTMLElement).style.display).toBe('none')
    expect(cells[index]!.text()).toBe('')
  }
  expect(wrapper.find('th[rowspan]').exists()).toBe(false)
}

describe('Markdown syntax combinations', () => {
  for (const mode of ['preview', 'stored'] as const) {
    test(`preserves combined tables, lists, links, bindings and literal code in ${mode}`, async () => {
      const wrapper = await render(mixedMarkdown, mode)
      try {
        expectMixedTable(wrapper)
        expect(wrapper.get('dt strong').text()).toBe('用語')
        expect(wrapper.get('dd a').attributes('href')).toBe('/guide')
        expect(wrapper.get('dd code').text()).toBe('code')
        const checkboxes = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
        expect(checkboxes.map((box) => box.element.checked)).toEqual([true, false])
        expect(checkboxes.every((box) => box.element.disabled)).toBe(true)
        const external = wrapper.get('blockquote a')
        expect(external.attributes('target')).toBe('_blank')
        expect(external.attributes('rel')).toContain('noopener')
        expect(external.attributes('rel')).toContain('noreferrer')
        expect(wrapper.get('a[href*="wikihouse.com"]').attributes('href')).toContain('%A5%E9')
        const reference = wrapper.get('a[data-footnote-ref]')
        const noteId = reference.attributes('href')!.slice(1)
        expect(wrapper.get(`[id="${noteId}"]`).get('strong').text()).toBe('補足')
        const backlink = wrapper.get('a[data-footnote-backref]')
        expect(backlink.attributes('href')).toBe(`#${reference.attributes('id')}`)
        expect(wrapper.get('pre code').text()).toContain('<img src="/example.png" onerror="example()">')
        expect(wrapper.find('script, iframe, img').exists()).toBe(false)
      } finally {
        wrapper.unmount()
      }
    })

    test(`keeps nested tab, collapsible, named slots and highlighting functional in ${mode}`, async () => {
      const wrapper = await render(nestedMarkdown, mode)
      try {
        expectMixedTable(wrapper)
        const tabs = wrapper.findAll('[role="tab"]')
        expect(tabs.map((tab) => tab.text())).toEqual(['一覧', '説明'])
        await tabs[1]!.trigger('keydown', { key: 'Enter' })
        await flushPromises()
        expect(tabs[1]!.attributes('aria-selected')).toBe('true')
        const collapse = wrapper.get('button[aria-expanded]')
        await collapse.trigger('click')
        await flushPromises()
        expect(collapse.attributes('aria-expanded')).toBe('true')
        expect(wrapper.getComponent(ProseCard).get('strong').text()).toBe('見出し')
        expect(wrapper.getComponent(ProseBadge).text()).toBe('新規')
        expect(wrapper.text()).toContain('詳細 と 結合セル')
        expect(wrapper.get('pre code').text()).toBe('const value = "<script>example()</script>"')
        expect(wrapper.find('pre span[style*="--shiki-light"]').exists()).toBe(true)
        expect(wrapper.find('script, style').exists()).toBe(false)
        await collapse.trigger('click')
        expect(collapse.attributes('aria-expanded')).toBe('false')
        await tabs[0]!.trigger('keydown', { key: 'Enter' })
        await flushPromises()
        expectMixedTable(wrapper)
      } finally {
        wrapper.unmount()
      }
    })
  }
})
