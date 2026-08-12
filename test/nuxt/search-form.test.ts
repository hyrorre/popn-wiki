import { describe, expect, test } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { useRouter } from '#imports'
import SearchForm from '../../components/SearchForm.vue'

describe('SearchForm', () => {
  test('keeps comment search mode and submits a trimmed query', async () => {
    const wrapper = await mountSuspended(SearchForm, {
      route: '/search?type=comments&q=%20%20%E3%83%9D%E3%83%83%E3%83%97%E3%83%B3%20%20'
    })
    const router = useRouter()

    await wrapper.setupState.submitSearch()
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/search')
    expect(router.currentRoute.value.query).toEqual({
      q: 'ポップン',
      type: 'comments'
    })
  })

  test('does not submit a one-character query', async () => {
    const wrapper = await mountSuspended(SearchForm, {
      route: '/search?q=a'
    })
    const router = useRouter()

    await wrapper.setupState.submitSearch()
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/search?q=a')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
