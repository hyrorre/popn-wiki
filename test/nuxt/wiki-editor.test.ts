import { flushPromises } from '@vue/test-utils'
import { createError, readBody } from 'h3'
import { describe, expect, test, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WikiEditor from '../../components/WikiEditor.vue'

const savedPage = {
  path: 'characterization/editor',
  title: 'Changed',
  revision: 4,
  body: '# Changed',
  bodyAst: null,
  message: 'UI test',
  minor: 1,
  createdBy: '101',
  updatedBy: '101',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z'
}

function registerHistoryEndpoint() {
  return registerEndpoint('/api/page/history', {
    method: 'GET',
    handler: () => []
  })
}

describe('WikiEditor', () => {
  test('submits the current body and emits the saved page', async () => {
    const unregisterHistory = registerHistoryEndpoint()
    let receivedBody: unknown
    const unregisterSave = registerEndpoint('/api/page', {
      method: 'PUT',
      handler: async (event) => {
        receivedBody = await readBody(event)
        return savedPage
      }
    })

    try {
      const wrapper = await mountSuspended(WikiEditor, {
        props: {
          path: savedPage.path,
          initialBody: '# Before',
          baseRevision: 3
        },
        global: {
          stubs: {
            MarkdownToolbar: true,
            MDC: true,
            UModal: true
          }
        }
      })

      await wrapper.get('textarea').setValue(savedPage.body)
      const saveButton = wrapper.findAll('button').find((button) => button.text().trim() === '保存')
      expect(saveButton).toBeDefined()
      await saveButton!.trigger('click')
      await vi.waitFor(() => expect(saveButton!.text().trim()).toBe('保存'))

      expect(receivedBody).toEqual({
        path: savedPage.path,
        body: savedPage.body,
        baseRevision: 3,
        message: '',
        minor: 0
      })
      expect(wrapper.emitted('saved')?.[0]).toEqual([savedPage])
    } finally {
      unregisterSave()
      unregisterHistory()
    }
  })

  test('emits the latest revision returned by a conflict response', async () => {
    const unregisterHistory = registerHistoryEndpoint()
    const unregisterSave = registerEndpoint('/api/page', {
      method: 'PUT',
      handler: () => {
        throw createError({
          statusCode: 409,
          statusMessage: 'Revision conflict.',
          data: { latestRevision: 7 }
        })
      }
    })

    try {
      const wrapper = await mountSuspended(WikiEditor, {
        props: {
          path: savedPage.path,
          initialBody: '# Before',
          baseRevision: 3
        },
        global: {
          stubs: {
            MarkdownToolbar: true,
            MDC: true,
            UModal: true
          }
        }
      })
      const saveButton = wrapper.findAll('button').find((button) => button.text().trim() === '保存')

      await saveButton!.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('conflict')?.[0]).toEqual([7])
    } finally {
      unregisterSave()
      unregisterHistory()
    }
  })
})
