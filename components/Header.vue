<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { app } = useAppConfig()

const { user, clear: clearSession } = useUserSession()

const signOut = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  useRouter().push('/')
}

const { data: profile } = await useFetch('/api/profile')

const items = computed((): NavigationMenuItem[][] => [
  [
    {
      label: app.title,
      icon: 'i-public-icon',
      to: '/',
      active: false,
      class: 'site-title'
    }
  ],
  user.value
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
])
</script>

<template>
  <header class="border-b border-default mb-8">
    <u-navigation-menu :items="items" content-orientation="vertical" />
  </header>
</template>
