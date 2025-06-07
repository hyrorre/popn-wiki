<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { app } = useAppConfig()

const signOut = () => {
  const supabase = useSupabaseClient()
  supabase.auth.signOut().then(() => useRouter().push('/'))
}

const user = useSupabaseUser()
const { data: profile } = user.value ? await useFetch('/api/profile') : { data: ref(null) }

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
          label: profile.value?.name,
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
  <header class="border-b border-(--ui-border) mb-8">
    <u-navigation-menu :items="items" content-orientation="vertical" />
  </header>
</template>
