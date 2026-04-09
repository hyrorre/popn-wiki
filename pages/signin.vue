<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

const { app } = useAppConfig()

useHead({
  title: 'SIGN IN'
})

const fields = ref<AuthFormField[]>([
  {
    name: 'email',
    type: 'text',
    label: 'Email'
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password'
  }
])

const error_message = ref('')

const { fetch: refreshSession } = useUserSession()

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>

const submit = async (payload: FormSubmitEvent<Schema>) => {
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: payload.data
    })
    await refreshSession()
    useRouter().push('/')
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    error_message.value = fetchError.data?.message || 'Login failed'
  }
}
</script>

<template>
  <u-container class="text-center h-full flex flex-col justify-center">
    <h1 class="text-4xl">{{ app.title }}</h1>
    <div>
      <u-card class="mt-8 sm:max-w-md mx-auto" variant="subtle">
        <u-auth-form
          title="ログイン"
          :fields="fields"
          :schema="schema"
          :submit="{ label: 'ログイン' }"
          @submit="submit"
        >
          <template #validation>
            <u-alert v-if="error_message" color="error" icon="i-lucide-info" :title="error_message" />
          </template>
        </u-auth-form>
        <u-button to="/forgot" color="neutral" variant="link" class="mt-2">パスワードを忘れた方はこちら</u-button>
        <template #footer>
          <u-button
            to="/forgot"
            color="info"
            variant="subtle"
            label="旧WikiからのID移行はこちら"
            icon="i-lucide-terminal"
            block
          />
        </template>
      </u-card>
    </div>
  </u-container>
</template>
