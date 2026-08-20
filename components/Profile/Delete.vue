<script setup lang="ts">
const { clear: clearSession } = useUserSession()

const form = reactive({
  del: ''
})
const message = ref('')
const isSubmitting = ref(false)
const confirmationMatches = computed(() => form.del === 'Delete')

const submit = async () => {
  if (!confirmationMatches.value || isSubmitting.value) return

  isSubmitting.value = true
  message.value = ''

  try {
    await $fetch('/api/user/delete', {
      method: 'POST'
    })
    await clearSession()
    await navigateTo('/')
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    message.value = fetchError.data?.message || 'アカウントの削除に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>アカウントを削除</h3>
    </template>
    <div>アカウントを削除すると、プロフィールとログイン情報が削除されます。</div>
    <p class="mt-2 text-sm text-muted">投稿したページやコメントは、投稿者情報なしで残ります。</p>
    <u-modal
      title="アカウントを削除"
      description='アカウントを削除してもよろしいですか？\n削除する場合は"Delete"と入力してください。'
    >
      <u-button color="error" class="mt-4">アカウントを削除</u-button>
      <template #body>
        <u-form :state="form" @submit="submit">
          アカウントを削除してもよろしいですか？<br />削除する場合は"Delete"と入力してください。
          <u-form-field name="del" class="mt-4">
            <u-input v-model="form.del" required class="w-full" size="lg" />
          </u-form-field>
          <div class="mt-4 flex justify-end items-center">
            <div class="mr-4">{{ message }}</div>
            <u-button
              color="error"
              type="submit"
              :variant="confirmationMatches ? 'solid' : 'outline'"
              :disabled="!confirmationMatches"
              :loading="isSubmitting"
            >
              アカウントを削除
            </u-button>
          </div>
        </u-form>
      </template>
    </u-modal>
  </u-card>
</template>
