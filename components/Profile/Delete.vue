<script setup lang="ts">
const supabase = useSupabaseClient()
const message = ref('')
const form = reactive({
  del: ''
})

const submit = async () => {
  await $fetch('/api/user/delete', {
    method: 'POST'
  })
    .then(async () => {
      supabase.auth.signOut().finally(() => {
        message.value = 'Account deleted.'
        alert('Account deleted.')
        useRouter().push('/')
      })
    })
    .catch((error) => {
      message.value = error.message
    })
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>{{ $t('delete_account') }}</h3>
    </template>
    <div>{{ $t('delete_account_description') }}</div>
    <u-modal :title="$t('delete_account')" :description="$t('delete_account_confirm')">
      <u-button color="error" class="mt-4">{{ $t('delete_account') }}</u-button>
      <template #body>
        <u-form :state="form" @submit="submit">
          {{ $t('delete_account_confirm') }}
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
              {{ $t('delete_account') }}
            </u-button>
          </div>
        </u-form>
      </template>
    </u-modal>
  </u-card>
</template>
