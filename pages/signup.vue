<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { signupSchema, type SignupInput } from '~/shared/zod'

const { app } = useAppConfig()

useSeoMeta({
  title: '新規登録',
  ogTitle: '新規登録',
  ogUrl: `${app.url}/signup`,
  robots: 'noindex',
})

const fields = ref<AuthFormField[]>([
  {
    name: 'name',
    type: 'text',
    label: 'ユーザー名'
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

const schema = signupSchema

const providers = [
  {
    label: 'Googleで登録',
    icon: 'i-mdi-google',
    to: '/api/auth/google',
    external: true
  }
]

const submit = async (payload: FormSubmitEvent<SignupInput>) => {
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
    <h1>
      <u-button to="/" variant="ghost" color="neutral" class="text-3xl">{{ app.title }}</u-button>
    </h1>
    <div>
      <u-card class="mt-8 sm:max-w-md mx-auto" variant="subtle">
        <!-- @vue-expect-error -->
        <u-auth-form
          title="新規アカウント登録"
          :fields="fields"
          :schema="schema"
          :providers="providers"
          :submit="{ label: '登録' }"
          @submit="submit"
        >
          <template #validation>
            <u-alert
              color="info"
              variant="soft"
              icon="i-lucide-shield-check"
              title="パスワードは15文字以上、または記号を含む8文字以上で入力してください。"
              description="推測されやすい文字列、ユーザー名、メールアドレスの一部は使用できません。"
              class="mb-4 text-left"
            />
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
