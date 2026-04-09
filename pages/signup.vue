<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

const { app } = useAppConfig()

useHead({
  title: '新規登録'
})

const fields = ref<AuthFormField[]>([
  {
    name: 'name',
    type: 'text',
    label: '名前'
  },
  {
    name: 'email',
    type: 'text',
    label: 'メールアドレス'
  },
  {
    name: 'password',
    type: 'password',
    label: 'パスワード'
  }
])

const error_message = ref('')
const open = ref(false)

const schema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  email: z.email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください')
})

type Schema = z.output<typeof schema>

const submit = async (payload: FormSubmitEvent<Schema>) => {
  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: payload.data
    })
    error_message.value = ''
    open.value = true // メール確認案内モーダルを表示
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    error_message.value = fetchError.data?.message || '登録に失敗しました'
  }
}
</script>

<template>
  <u-container class="text-center h-full flex flex-col justify-center">
    <h1 class="text-4xl">{{ app.title }}</h1>
    <div>
      <u-card class="mt-8 sm:max-w-md mx-auto" variant="subtle">
        <u-auth-form
          title="新規アカウント登録"
          :fields="fields"
          :schema="schema"
          :submit="{ label: '登録' }"
          @submit="submit"
        >
          <template #validation>
            <u-alert v-if="error_message" color="error" icon="i-lucide-info" :title="error_message" />
          </template>
        </u-auth-form>
        <div class="mt-4">
          <u-button to="/signin" color="neutral" variant="link">既にアカウントをお持ちの方はこちら</u-button>
        </div>
      </u-card>
    </div>

    <u-modal v-model:open="open" :close="false">
      <template #header>
        <h2 class="text-xl">仮登録が完了しました</h2>
      </template>
      <template #body>
        <p>確認メールを送信しました。メール内のリンクをクリックして登録を完了させてください。</p>
        <u-button to="/signin" class="mt-4" block>ログイン画面へ</u-button>
      </template>
    </u-modal>
  </u-container>
</template>
