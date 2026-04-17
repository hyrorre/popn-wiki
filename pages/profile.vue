<script setup lang="ts">
useHead({
  title: 'MY PROFILE'
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
