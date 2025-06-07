<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { data: config } = await useFetch('/api/config')

const signOut = () => {
  const supabase = useSupabaseClient()
  supabase.auth.signOut().then(() => useRouter().push('/'))
}

const id = useRoute().params.id
const user = useSupabaseUser()
const { data: profile } = await useFetch('/api/profile')

const items = computed((): NavigationMenuItem[][] => [
  (
    [
      {
        label: config.value?.title || '',
        icon: 'i-public-icon',
        to: '/',
        active: false,
        class: 'site-title'
      }
    ] as NavigationMenuItem[]
  ).concat(
    user.value || id
      ? [
          {},
          {
            label: 'Score',
            icon: 'i-tabler-table',
            to: id ? `/user/${id}` : '/my'
          },
          {
            label: 'Stat',
            icon: 'i-tabler-chart-bar',
            to: id ? `/user/${id}/stat` : '/my/stat'
          }
        ]
      : []
  ),
  user.value
    ? [
        {
          class: 'profile',
          label: profile.value?.name,
          icon: 'i-tabler-user',
          children: [
            {
              label: 'Profile',
              to: '/my/profile'
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
