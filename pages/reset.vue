<script setup lang="ts">
const { app } = useAppConfig()

useHead({
  title: 'RESET PASSWORD'
})

const supabase = useSupabaseClient()

const form = reactive({
  password: ''
})

const error_message = ref('')

const submit = async () => {
  const { error } = await supabase.auth.updateUser(form)
  if (error) {
    alert('Error : ' + error.message)
  } else {
    alert('Password reset succeeded.')
  }
}
</script>

<template>
  <u-container class="text-center h-full flex flex-col justify-center">
    <h1 class="text-4xl">{{ app.title }}</h1>
    <div>
      <u-card class="mt-8 sm:max-w-md mx-auto" variant="subtle">
        <u-form :state="form" @submit="submit">
          <u-form-field label="Password" name="password">
            <u-input v-model="form.password" required autofocus class="w-full" size="lg" type="password" />
          </u-form-field>
          <p>{{ error_message }}</p>
          <div class="flex justify-end items-end">
            <u-button type="submit" size="lg" class="mt-8">SUBMIT</u-button>
          </div>
        </u-form>
      </u-card>
    </div>
  </u-container>
</template>
