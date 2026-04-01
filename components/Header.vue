<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { app } = useAppConfig()
const { user, clear: clearSession } = useUserSession()
const { editMode, canEdit, toggleEditMode, setSidebarOpen } = usePageActions()

const signOut = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  useRouter().push('/')
}

const { data: profile } = await useFetch('/api/profile')

const items = computed((): NavigationMenuItem[][] => {
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
      label: editMode.value ? '閲覧に戻る' : '編集する',
      icon: editMode.value ? 'i-heroicons-eye' : 'i-heroicons-pencil-square',
      onSelect: () => {
        toggleEditMode()
      }
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
              label: 'Profile',
              to: '/profile'
            },
            {
              label: 'Sign Out',
              onSelect: () => signOut()
            }
          ]
        }
      ]
    : [
        {
          label: 'Sign In',
          icon: 'i-tabler-login',
          to: '/signin'
        },
        {
          label: 'Sign Up',
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
        <u-navigation-menu v-if="items[1] && items[2]" :items="[...items[1], ...items[2]]" />
      </div>
    </u-container>
  </header>
</template>
