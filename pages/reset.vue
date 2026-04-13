<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

const { app } = useAppConfig()
const route = useRoute()
const token = route.query.token as string

useHead({
  title: '新しいパスワードの設定'
})

const fields = ref<AuthFormField[]>([
  {
    name: 'password',
    type: 'password',
    label: '新しいパスワード'
  }
])

const error_message = ref('')
const success = ref(false)

const schema = z.object({
  password: z.string().min(8, 'パスワードは8文字以上で入力してください')
})

type Schema = z.output<typeof schema>

const submit = async (payload: FormSubmitEvent<Schema>) => {
  if (!token) {
    error_message.value = '無効なリクエストです。'
    return
  }

  try {
    await $fetch('/api/auth/reset', {
      method: 'POST',
      body: {
        token,
        password: payload.data.password
      }
    })
    error_message.value = ''
    success.value = true
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    error_message.value = fetchError.data?.message || 'パスワードの変更に失敗しました'
  }
}
</script>

<template>
  <u-container class="text-center h-full flex flex-col justify-center">
    <h1 class="text-4xl">{{ app.title }}</h1>
    <div>
      <u-card class="mt-8 sm:max-w-md mx-auto" variant="subtle">
        <template v-if="!success">
          <u-auth-form
            title="パスワードの再設定"
            description="新しいパスワードを入力してください。"
            :fields="fields"
            :schema="schema"
            :submit="{ label: 'パスワードを変更' }"
            @submit="submit"
          >
            <template #validation>
              <u-alert v-if="error_message" color="error" icon="i-lucide-info" :title="error_message" />
              <u-alert
                v-if="!token"
                color="warning"
                icon="i-lucide-alert-triangle"
                title="トークンが見つかりません。メールのリンクから再度アクセスしてください。"
              />
            </template>
          </u-auth-form>
        </template>
        <template v-else>
          <div class="py-8">
            <u-icon name="i-lucide-check-circle" class="w-16 h-16 text-success mx-auto mb-4" />
            <h2 class="text-2xl font-bold mb-2">再設定完了</h2>
            <p class="text-neutral-500 mb-6">パスワードが正常に変更されました。</p>
            <u-button to="/signin" block size="lg">ログイン画面へ</u-button>
          </div>
        </template>
      </u-card>
    </div>
  </u-container>
</template>
