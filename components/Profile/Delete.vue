<script setup lang="ts">
const { clear: clearSession } = useUserSession()

const form = reactive({
  del: ''
})
const message = ref('')

const submit = async () => {
  try {
    await $fetch('/api/user/delete', {
      method: 'POST'
    })
    await clearSession()
    message.value = 'Account deleted.'
    alert('Account deleted.')
    useRouter().push('/')
  } catch (err) {
    const error = err as { message?: string }
    message.value = error.message || 'Deletion failed'
  }
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>アカウントを削除</h3>
    </template>
    <div>アカウントを削除すると、すべてのデータが削除されます。</div>
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
              :variant="!form.del.includes('Delete') ? 'outline' : 'solid'"
              :disabled="!form.del.includes('Delete')"
            >
              アカウントを削除
            </u-button>
          </div>
        </u-form>
      </template>
    </u-modal>
  </u-card>
</template>
