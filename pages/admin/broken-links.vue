<script setup lang="ts">
const { user } = useUserSession()
const { setCanEdit, setRevision } = usePageActions()
const { app } = useAppConfig()

watchEffect(() => {
  setCanEdit(false)
  setRevision(null)
})

useSeoMeta({
  title: 'リンク切れチェッカー',
  description: 'Wiki内のリンク切れURLや画像を一覧表示し、一括でチェックできる管理者向けツールです。',
  ogTitle: 'リンク切れチェッカー',
  ogDescription: 'Wiki内のリンク切れURLや画像を一覧表示し、一括でチェックできる管理者向けツールです。',
  ogUrl: `${app.url}/admin/broken-links`,
  robots: 'noindex',
})
</script>

<template>
  <Header />

  <UContainer class="py-10">
    <AdminBrokenLinkList v-if="user" />
    <div v-else class="py-12 text-center">
      <p class="text-muted text-lg">リンク切れチェックにはログインが必要です。</p>
      <UButton class="mt-4" to="/signin">ログインページへ</UButton>
    </div>
  </UContainer>

  <Footer />
</template>
