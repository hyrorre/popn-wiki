<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

const { app } = useAppConfig()

useHead({
  title: 'パスワード再設定'
})

const fields = ref<AuthFormField[]>([
  {
    name: 'email',
    type: 'text',
    label: 'Email'
  }
])

const error_message = ref('')

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>

const submit = async (payload: FormSubmitEvent<Schema>) => {
  try {
    await $fetch('/api/auth/forgot', {
      method: 'POST',
      body: payload.data
    })
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    error_message.value = fetchError.data?.message || 'Failed to send reset email'
  }
}
</script>

<template>
  <u-container class="text-center h-full flex flex-col justify-center">
    <h1 class="text-4xl">{{ app.title }}</h1>
    <div>
      <u-card class="mt-8 sm:max-w-md mx-auto" variant="subtle">
        <u-auth-form
          title="パスワード再設定"
          :fields="fields"
          :schema="schema"
          :submit="{ label: '送信' }"
          @submit="submit"
        >
          <template #validation>
            <u-alert v-if="error_message" color="error" icon="i-lucide-info" :title="error_message" />
          </template>
        </u-auth-form>
      </u-card>
    </div>
  </u-container>
</template>
