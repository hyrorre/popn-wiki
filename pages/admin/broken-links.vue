<script setup lang="ts">
useSeoMeta({
  title: 'リンク切れチェッカー - Popn Wiki',
  description: 'Wiki内のリンク切れURLや画像を一覧表示し、一括でチェックできる管理者向けツールです。'
})
</script>

<template>
  <UContainer class="py-10">
    <AdminBrokenLinkList />
  </UContainer>
</template>
