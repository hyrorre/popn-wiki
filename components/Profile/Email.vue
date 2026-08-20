<script setup lang="ts">
const { user } = useUserSession()
</script>

<template>
  <u-card>
    <template #header>
      <h3>メールアドレス</h3>
    </template>
    <div v-if="!user?.email">読み込み中...</div>
    <div v-else>
      <u-form-field label="メールアドレス" name="email">
        <u-input :model-value="user.email" disabled class="w-full" size="lg" />
      </u-form-field>
      <p class="mt-2 text-sm text-muted">現在、メールアドレスは変更できません。</p>
    </div>
  </u-card>
</template>
