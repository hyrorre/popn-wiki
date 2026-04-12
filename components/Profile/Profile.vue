<script setup lang="ts">
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

const submit = async () => {
  if (!form.value) return
  try {
    await $fetch('/api/profile', {
      method: 'POST',
      body: form.value
    })
    message.value = 'Saved.'
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    message.value = fetchError.data?.message || 'Save failed'
  }
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>プロフィール</h3>
    </template>
    <div v-if="status === 'pending'">読込中...</div>
    <div v-else-if="error">{{ error.message }}</div>
    <u-form v-else-if="form" :state="form" @submit="submit">
      <u-form-field label="name" name="name">
        <u-input v-model="form.name" required class="w-full" size="lg" />
      </u-form-field>
      <div class="mt-4 flex justify-end items-center">
        <div class="mr-4">{{ message }}</div>
        <u-button type="submit">保存</u-button>
      </div>
    </u-form>
  </u-card>
</template>
