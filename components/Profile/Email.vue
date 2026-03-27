<script setup lang="ts">
const { user } = useUserSession()

const message = ref('')

const submit = async () => {
  message.value = 'Email update via nuxt-auth-utils would require custom logic. Not implemented yet.'
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>{{ $t('email') }}</h3>
    </template>
    <div v-if="!user?.email">{{ $t('loading') }}</div>
    <u-form v-else :state="user" @submit="submit">
      <u-form-field :label="$t('email')" name="email">
        <u-input v-model="user.email" required autofocus class="w-full" size="lg" />
      </u-form-field>
      <div class="mt-4 flex justify-end items-center">
        <div class="mr-4">{{ message }}</div>
        <u-button type="submit">{{ $t('save') }}</u-button>
      </div>
    </u-form>
  </u-card>
</template>
