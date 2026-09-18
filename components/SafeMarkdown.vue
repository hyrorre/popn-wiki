<script setup lang="ts">
import { sanitizeMdcMetadata, sanitizeMdcRoot } from '~/utils/markdown-security'

defineOptions({ inheritAttrs: false })
defineProps<{ value: string }>()
</script>

<template>
  <MDC v-slot="{ body, data }" :value="value">
    <MDCRenderer v-if="body" :body="sanitizeMdcRoot(body, data)" :data="sanitizeMdcMetadata(data)" v-bind="$attrs" />
  </MDC>
</template>
