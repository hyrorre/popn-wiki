<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { app } = useAppConfig()
const { user, clear: clearSession } = useUserSession()
const { canEdit, setSidebarOpen, revision } = usePageActions()

const signOut = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  useRouter().push('/')
}

const { data: profile } = await useFetch('/api/profile')

const items = computed((): NavigationMenuItem[][] => {
  const route = useRoute()
  const isEditPage = computed(() => route.path.startsWith('/edit'))
  const path = computed(() => {
    const p = route.params.path
    return (typeof p === 'string' ? p : p?.join('/')) || ''
  })

  const leftItems: NavigationMenuItem[] = [
    {
      label: app.title,
      icon: 'i-public-icon',
      to: '/',
      active: false,
      class: 'site-title'
    }
  ]

  const actionItems: NavigationMenuItem[] = []
  if (canEdit.value) {
    actionItems.push({
      label: isEditPage.value ? '閲覧に戻る' : revision.value ? '編集する' : '新規作成',
      icon: isEditPage.value ? 'i-heroicons-eye' : revision.value ? 'i-heroicons-pencil-square' : 'i-heroicons-plus',
      to: (isEditPage.value ? `/${path.value}` : `/edit/${path.value}`).replace('//', '/')
    })
  }

  const userItems: NavigationMenuItem[] = user.value
    ? [
        {
          class: 'profile',
          label: profile.value?.name ?? undefined,
          icon: 'i-tabler-user',
          children: [
            {
              label: 'アカウント設定',
              to: '/profile'
            },
            {
              label: 'ログアウト',
              onSelect: () => signOut()
            }
          ]
        }
      ]
    : [
        {
          label: 'ログイン',
          icon: 'i-tabler-login',
          to: '/signin'
        },
        {
          label: '新規登録',
          icon: 'i-tabler-user-plus',
          to: '/signup'
        }
      ]

  return [leftItems, actionItems, userItems]
})
</script>

<template>
  <header class="border-b border-default mb-8">
    <u-container class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <u-button
          icon="i-heroicons-bars-3"
          variant="ghost"
          color="neutral"
          class="lg:hidden"
          @click="setSidebarOpen(true)"
        />
        <u-navigation-menu v-if="items[0]" :items="items[0]" />
      </div>
      <div class="flex items-center gap-2">
        <u-navigation-menu
          v-if="items[1] && items[2]"
          :items="[...items[1], ...items[2]]"
          content-orientation="vertical"
        />
      </div>
    </u-container>
  </header>
</template>
