<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const {
  data: form,
  error,
  status
} = useAsyncData<Profile>(async () => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.value!.sub).single<Profile>()
  if (error) {
    const { data, error: error2 } = await supabase
      .from('profiles')
      .insert({ id: user.value?.sub })
      .select()
      .single<Profile>()

    if (error2) {
      throw error
    }
    return data
  }
  return data
})

const message = ref('')

const submit = () => {
  form.value!.updated_at = new Date().toISOString()
  supabase
    .from('profiles')
    .upsert(form.value)
    .then(async ({ error }) => {
      message.value = error ? error.message : 'Saved.'
    })
}
</script>

<template>
  <u-card>
    <template #header>
      <h3>{{ $t('profile') }}</h3>
    </template>
    <div v-if="status === 'pending'">{{ $t('loading') }}</div>
    <div v-else-if="error">{{ error.message }}</div>
    <u-form v-else-if="form" :state="form" @submit="submit">
      <u-form-field label="name" name="name">
        <u-input v-model="form.name" required class="w-full" size="lg" />
      </u-form-field>
      <div class="mt-4 flex justify-end items-center">
        <div class="mr-4">{{ message }}</div>
        <u-button type="submit">{{ $t('save') }}</u-button>
      </div>
    </u-form>
  </u-card>
</template>
