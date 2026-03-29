<template>
  <div class="rounded-2xl bg-slate-50 px-5 py-4">
    <p class="text-sm text-slate-500">{{ label }}</p>
    <p class="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{{ value }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
}>()
</script>
