<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 px-4">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">{{ title }}</h3>
        <p class="mt-2 text-sm leading-6 text-slate-500">{{ message }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="button-secondary" @click="$emit('cancel')">取消</button>
          <button type="button" :class="destructive ? 'button-danger' : 'button-primary'" @click="$emit('confirm')">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>
