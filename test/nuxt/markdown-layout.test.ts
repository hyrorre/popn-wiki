import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { MDCRenderer } from '#components'
import SafeMarkdown from '../../components/SafeMarkdown.vue'
import { parseSafeMarkdown } from '../../server/utils/markdown'

const value =
  '<div style="text-align:center;position:fixed;display:none"><ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby><img src="/example.png" style="width:160px;max-width:100%;height:auto;top:0;background:url(https://example.com)"></div>\n\nText[^a]\n\n[^a]: A footnote'
describe('safe HTML layout', () => {
  for (const mode of ['preview', 'stored'] as const) {
    test(`keeps ruby, alignment, image dimensions and footnote structure in ${mode}`, async () => {
      const { ast } = await parseSafeMarkdown(value)
      const wrapper =
        mode === 'preview'
          ? await mountSuspended(SafeMarkdown, { props: { value } })
          : await mountSuspended(MDCRenderer, { props: { body: ast.body, data: ast.data } })
      expect(wrapper.get('ruby rt').text()).toBe('かんじ')
      const block = wrapper.get('ruby').element.parentElement!
      expect(block.style.textAlign).toBe('center')
      expect(block.style.position).toBe('')
      expect(block.style.display).toBe('')
      const image = wrapper.get('img').element
      expect(image.style.width).toBe('160px')
      expect(image.style.maxWidth).toBe('100%')
      expect(image.style.height).toBe('auto')
      expect(image.style.top).toBe('')
      expect(image.style.background).toBe('')
      expect(wrapper.find('section.footnotes').exists()).toBe(true)
      wrapper.unmount()
    })
  }
})
