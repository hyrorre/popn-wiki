<script setup lang="ts">
const { app } = useAppConfig()

useHead({
  title: 'SIGN UP'
})

const form = reactive({
  email: '',
  password: ''
})
const error_message = ref('')
const showPassword = ref(false)

const open = ref(false)

const submit = async () => {
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: form
    })
    error_message.value = ''
    open.value = true // open modal
  } catch (err) {
    const fetchError = err as { data?: { message?: string } }
    error_message.value = fetchError.data?.message || 'Registration failed'
  }
}
</script>

<template>
  <u-container class="text-center h-full flex flex-col justify-center">
    <h1 class="text-4xl">{{ app.title }}</h1>
    <div>
      <u-card class="mt-8 sm:max-w-md mx-auto" variant="subtle">
        <u-form :state="form" @submit="submit">
          <u-form-field label="Email" name="email">
            <u-input v-model="form.email" required autofocus class="w-full" size="lg" />
          </u-form-field>
          <u-form-field label="Password" name="password" class="mt-4">
            <u-input v-model="form.password" required class="w-full" size="lg" :type="showPassword ? 'text' : 'password'">
              <template #trailing>
                <u-button
                  color="neutral"
                  variant="link"
                  :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </u-input>
          </u-form-field>
          <p>{{ error_message }}</p>
          <div class="flex justify-end items-end">
            <u-button type="submit" size="lg" class="mt-8">SIGN UP</u-button>
          </div>
        </u-form>
      </u-card>
    </div>
    <u-modal v-model:open="open" :close="false">
      <template #header>
        <h2 class="text-xl">Sign up completed.</h2>
      </template>
      <template #body>
        <p>Check your email box.</p>
        <u-button to="/" class="mt-4">Close</u-button>
      </template>
    </u-modal>
  </u-container>
</template>
