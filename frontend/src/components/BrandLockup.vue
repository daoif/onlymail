<template>
  <div class="flex items-center gap-3" :class="centered ? 'justify-center text-center' : ''">
    <img
      src="/brand/onlymail-mark-512.png"
      alt="OnlyMail"
      class="shrink-0"
      :class="size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-10 w-10 rounded-xl'"
    />
    <div class="min-w-0">
      <component :is="titleTag" :class="size === 'lg' ? 'page-title' : 'text-lg font-semibold text-slate-900'">
        OnlyMail
      </component>
      <p v-if="subtitle" class="text-sm text-slate-500">{{ subtitle }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    subtitle?: string
    centered?: boolean
    size?: 'sm' | 'lg'
    titleTag?: 'h1' | 'p' | 'div'
  }>(),
  {
    subtitle: '',
    centered: false,
    size: 'sm',
    titleTag: 'p',
  },
)
</script>
