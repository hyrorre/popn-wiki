<script setup lang="ts">
definePageMeta({
  middleware: [
    async (to) => {
      const nuxtApp = useNuxtApp()
      const token = to.query.token as string

      if (!token) {
        return navigateTo('/signin')
      }

      try {
        await $fetch('/api/auth/verify', {
          params: { token }
        })
        // コンテキストを維持したままリダイレクトを実行
        return nuxtApp.runWithContext(() => navigateTo('/signin?verified=1'))
      } catch (err) {
        console.error('Verification failed:', err)
        return nuxtApp.runWithContext(() => navigateTo('/signin?error=verify_failed'))
      }
    }
  ]
})
</script>

<template>
  <u-container class="h-full flex flex-col items-center justify-center text-center">
    <u-icon name="i-lucide-loader-2" class="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
    <p class="text-neutral-500">確認中...</p>
  </u-container>
</template>
