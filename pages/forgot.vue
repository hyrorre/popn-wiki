<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

const { app } = useAppConfig()

useHead({
  title: 'パスワード再設定'
})

const fields = ref<AuthFormField[]>([
  {
    name: 'email',
    type: 'text',
    label: 'メールアドレス'
  }
])

const error_message = ref('')
const success_message = ref('')

const schema = z.object({
  email: z.email('有効なメールアドレスを入力してください')
})

type Schema = z.output<typeof schema>

const submit = async (payload: FormSubmitEvent<Schema>) => {
  try {
    await $fetch('/api/auth/forgot', {
      method: 'POST',
      body: payload.data
    })
    error_message.value = ''
    success_message.value = 'リセットメールを送信しました。'
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    error_message.value = fetchError.data?.message || '送信に失敗しました'
    success_message.value = ''
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
          description="登録されているメールアドレスを入力してください。再設定用のリンクを送信します。"
          :fields="fields"
          :schema="schema"
          :submit="{ label: 'リセットメールを送信' }"
          @submit="submit"
        >
          <template #validation>
            <u-alert v-if="error_message" color="error" icon="i-lucide-info" :title="error_message" />
            <u-alert v-if="success_message" color="success" icon="i-lucide-check-circle" :title="success_message" />
          </template>
        </u-auth-form>
        <div class="mt-4">
          <u-button to="/signin" color="neutral" variant="link">ログイン画面に戻る</u-button>
        </div>
      </u-card>
    </div>
  </u-container>
</template>
