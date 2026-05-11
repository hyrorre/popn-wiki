<script setup lang="ts">
const { app } = useAppConfig()

useSeoMeta({
  title: 'マイプロフィール',
  ogTitle: 'マイプロフィール',
  ogUrl: `${app.url}/profile`,
  robots: 'noindex',
})
</script>

<template>
  <Header :show-buttons="false" />
  <u-container>
    <Profile class="mt-8" />
    <ProfileEmail class="mt-8" />
    <ProfileDelete class="mt-8" />
  </u-container>
  <Footer />
</template>
