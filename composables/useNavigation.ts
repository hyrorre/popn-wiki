import type { NavigationMenuItem } from '@nuxt/ui'

export const useNavigation = (showButtons: boolean = true) => {
  const { app } = useAppConfig()
  const { user, clear: clearSession } = useUserSession()
  const { canEdit, revision, setSidebarOpen } = usePageActions()
  const route = useRoute()
  const router = useRouter()

  const signOut = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clearSession()
    setSidebarOpen(false)
    router.push('/')
  }

  const items = computed((): NavigationMenuItem[][] => {
    const isEditPage = route.path.startsWith('/edit')
    const path = (typeof route.params.path === 'string' ? route.params.path : route.params.path?.join?.('/')) || ''

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
    if (canEdit.value && showButtons) {
      actionItems.push({
        label: isEditPage ? '閲覧に戻る' : revision.value ? '編集する' : '新規作成',
        icon: isEditPage ? 'i-lucide-eye' : revision.value ? 'i-lucide-square-pen' : 'i-lucide-plus',
        to: (isEditPage ? `/${path}` : `/edit/${path}`).replace('//', '/')
      })
    }
    const userItems: NavigationMenuItem[] = user.value
      ? [
          {
            class: 'profile',
            label: user.value.name ?? user.value.login ?? 'プロフィール',
            icon: 'i-lucide-user',
            children: [
              {
                label: 'アカウント設定',
                to: '/profile',
                icon: 'i-lucide-settings'
              },
              {
                label: '返信一覧',
                to: '/reply',
                icon: 'i-lucide-bell'
              },
              {
                label: 'ログアウト',
                icon: 'i-lucide-log-out',
                onSelect: () => signOut()
              }
            ]
          }
        ]
      : [
          {
            label: 'ログイン',
            icon: 'i-lucide-log-in',
            to: '/signin'
          },
          {
            label: '新規登録',
            icon: 'i-lucide-user-plus',
            to: '/signup'
          }
        ]

    return [leftItems, actionItems, userItems]
  })

  return {
    items,
    signOut
  }
}
