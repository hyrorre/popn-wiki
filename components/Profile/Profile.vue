<script setup lang="ts">
const { user } = useUserSession()

const {
  data: form,
  error,
  status
} = useAsyncData<any>(async () => {
  return await $fetch('/api/profile')
})

const message = ref('')

const submit = async () => {
  try {
    await $fetch('/api/profile', {
      method: 'POST',
      body: form.value
    })
    message.value = 'Saved.'
  } catch (e: any) {
    message.value = e.data?.message || 'Save failed'
  }
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>{{ $t('profile') }}</h3>
    </template>
    <div v-if="status === 'pending'">{{ $t('loading') }}</div>
    <div v-else-if="error">{{ error.message }}</div>
    <u-form v-else-if="form" :state="form" @submit="submit">
      <u-form-field label="name" name="name">
        <u-input v-model="form.name" required class="w-full" size="lg" />
      </u-form-field>
      <div class="mt-4 flex justify-end items-center">
        <div class="mr-4">{{ message }}</div>
        <u-button type="submit">{{ $t('save') }}</u-button>
      </div>
    </u-form>
  </u-card>
</template>
