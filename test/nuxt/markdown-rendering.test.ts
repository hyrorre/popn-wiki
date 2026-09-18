import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SafeMarkdown from '../../components/SafeMarkdown.vue'
import DiscussionComment from '../../components/DiscussionComment.vue'

describe('Markdown previews', () => {
  test('rebuilds an existing comment table from Markdown when its stored AST predates the fix', async () => {
    const wrapper = await mountSuspended(DiscussionComment, {
      props: {
        path: 'table-test',
        comment: {
          id: 1,
          path: 'table-test',
          userId: 1,
          replyTo: null,
          replyToName: null,
          profiles: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          body: '| A | B |\n| --- | --- |\n| Joined | > |',
          bodyAst: JSON.stringify({
            data: { title: '', description: '' },
            body: {
              type: 'root',
              children: [
                {
                  type: 'element',
                  tag: 'table',
                  props: {},
                  children: [
                    {
                      type: 'element',
                      tag: 'tr',
                      props: {},
                      children: [
                        {
                          type: 'element',
                          tag: 'td',
                          props: { colSpan: '2' },
                          children: [{ type: 'text', value: 'Joined' }]
                        },
                        { type: 'element', tag: 'td', props: {}, children: [] }
                      ]
                    }
                  ]
                }
              ]
            }
          })
        }
      },
      global: { stubs: { CommentPanel: { template: '<div><slot /></div>' } } }
    })
    expect(wrapper.get('tbody td').attributes('colspan')).toBe('2')
    expect((wrapper.findAll('tbody td')[1]?.element as HTMLElement).style.display).toBe('none')
    wrapper.unmount()
  })

  test('renders merged cells without showing the cells they replace', async () => {
    const wrapper = await mountSuspended(SafeMarkdown, {
      props: {
        value: [
          '| Heading | > | C |',
          '| --- | --- | --- |',
          '| Wide | > | Value |',
          '| Tall | Other | Value |',
          '| ~ | Last | Value |'
        ].join('\n')
      }
    })
    const headers = wrapper.findAll('th')
    const rows = wrapper.findAll('tbody tr')
    expect(headers[0]?.attributes('colspan')).toBe('2')
    expect((headers[1]?.element as HTMLElement).style.display).toBe('none')
    expect(rows[0]?.findAll('td')[0]?.attributes('colspan')).toBe('2')
    expect((rows[0]?.findAll('td')[1]?.element as HTMLElement).style.display).toBe('none')
    expect(rows[1]?.findAll('td')[0]?.attributes('rowspan')).toBe('2')
    expect((rows[2]?.findAll('td')[0]?.element as HTMLElement).style.display).toBe('none')
    expect((rows[0]?.findAll('td')[0]?.element as HTMLElement).style.textAlign).toBe('center')
    expect((rows[1]?.findAll('td')[0]?.element as HTMLElement).style.verticalAlign).toBe('middle')
    wrapper.unmount()
  })

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
