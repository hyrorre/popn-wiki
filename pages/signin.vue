<script setup lang="ts">
import * as z from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

const { app } = useAppConfig()
const route = useRoute()
const verified = route.query.verified
const reset = route.query.reset
const verify_failed = computed(() => route.query.error === 'verify_failed')

useHead({
  title: 'サインイン'
})

const fields = ref<AuthFormField[]>([
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
const statusCode = ref(0)
const emailForResend = ref('')
const resend_loading = ref(false)
const resend_message = ref('')

const { fetch: refreshSession } = useUserSession()

const schema = z.object({
  email: z.email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードを入力してください')
})

type Schema = z.output<typeof schema>

const providers = [
  {
    label: 'Googleでログイン',
    icon: 'i-mdi-google',
    to: '/api/auth/google',
    external: true
  }
]

const submit = async (payload: FormSubmitEvent<Schema>) => {
  resend_message.value = ''
  await $fetch('/api/auth/signin', {
    method: 'POST',
    body: payload.data
  })
    .then(async () => {
      await refreshSession()
      useRouter().push('/')
    })
    .catch((err) => {
      statusCode.value = err.statusCode
      emailForResend.value = payload.data.email
      error_message.value =
        err.statusCode === 401
          ? 'ログインに失敗しました'
          : err.statusCode === 403
            ? 'メールアドレスが確認されていません。'
            : '予期せぬエラーが発生しました'
    })
}

const resendVerification = async () => {
  if (!emailForResend.value) return
  resend_loading.value = true
  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: emailForResend.value }
    })
    resend_message.value = '確認メールを再送しました。'
    error_message.value = ''
  } catch (err) {
    console.error(err)
    error_message.value = '再送に失敗しました'
  } finally {
    resend_loading.value = false
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
        <u-auth-form
          title="ログイン"
          :fields="fields"
          :schema="schema"
          :providers="providers"
          :submit="{ label: 'ログイン' }"
          @submit="submit"
        >
          <template #validation>
            <u-alert
              v-if="verified"
              color="success"
              icon="i-lucide-check-circle"
              title="メールアドレスの確認が完了しました。ログインしてください。"
              class="mb-4"
            />
            <u-alert
              v-if="reset"
              color="success"
              icon="i-lucide-check-circle"
              title="パスワードのリセットが完了しました。"
              class="mb-4"
            />
            <u-alert
              v-if="verify_failed"
              color="error"
              icon="i-lucide-alert-triangle"
              title="メールアドレスの確認に失敗しました。リンクの期限が切れているか、無効なトークンです。"
              class="mb-4"
            />
            <u-alert
              v-if="$route.query.error === 'google_failed'"
              color="error"
              icon="i-lucide-alert-triangle"
              title="Googleでのログインに失敗しました。"
              class="mb-4"
            />
            <u-alert
              v-if="$route.query.error === 'google_failed_no_email'"
              color="error"
              icon="i-lucide-alert-triangle"
              title="Googleアカウントからメールアドレスを取得できませんでした。"
              class="mb-4"
            />
            <div v-if="error_message" class="mb-4 space-y-2">
              <u-alert color="error" icon="i-lucide-info" :title="error_message" />
              <u-button
                v-if="statusCode === 403"
                color="warning"
                variant="subtle"
                block
                :loading="resend_loading"
                @click="resendVerification"
              >
                確認メールを再送する
              </u-button>
            </div>
            <u-alert
              v-if="resend_message"
              color="success"
              icon="i-lucide-check-circle"
              :title="resend_message"
              class="mb-4"
            />
          </template>
        </u-auth-form>
        <div class="mt-4 flex flex-col gap-1">
          <u-button to="/forgot" color="neutral" variant="link" size="sm">パスワードを忘れた方はこちら</u-button>
          <u-button to="/signup" color="neutral" variant="link" size="sm">アカウントをお持ちでない方はこちら</u-button>
        </div>
      </u-card>
    </div>
  </u-container>
</template>
