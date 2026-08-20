<script setup lang="ts">
const { fetch: refreshSession } = useUserSession()

const {
  data: form,
  error,
  status
} = useAsyncData(async () => {
  const profile = await $fetch('/api/profile')
  return {
    ...profile,
    name: profile.name ?? ''
  }
})

const message = ref('')
const isSubmitting = ref(false)

const submit = async () => {
  if (!form.value || isSubmitting.value) return

  isSubmitting.value = true
  message.value = ''

  try {
    const updated = await $fetch('/api/profile', {
      method: 'POST',
      body: form.value
    })
    form.value = {
      ...updated,
      name: updated.name ?? ''
    }
    await refreshSession()
    message.value = '保存しました。'
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    message.value = fetchError.data?.message || '保存に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>プロフィール</h3>
    </template>
    <div v-if="status === 'pending'">読み込み中...</div>
    <div v-else-if="error">{{ error.message }}</div>
    <u-form v-else-if="form" :state="form" @submit="submit">
      <u-form-field label="ユーザー名" name="name">
        <u-input v-model="form.name" required class="w-full" size="lg" />
      </u-form-field>
      <div class="mt-4 flex justify-end items-center">
        <div class="mr-4">{{ message }}</div>
        <u-button type="submit" :loading="isSubmitting">保存</u-button>
      </div>
    </u-form>
  </u-card>
</template>
