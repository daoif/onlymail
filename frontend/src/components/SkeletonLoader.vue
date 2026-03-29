<template>
  <div class="skeleton-container" :class="{ 'animate-pulse': true }">
    <slot>
      <!-- 默认骨架布局 -->
      <div v-if="variant === 'table'" class="space-y-3">
        <!-- 表头骨架 -->
        <div class="flex gap-4 rounded-lg bg-slate-100 px-4 py-3">
          <div v-for="n in columns" :key="n" class="h-4 flex-1 rounded bg-slate-200" />
        </div>
        <!-- 行骨架 -->
        <div v-for="r in rows" :key="r" class="flex gap-4 px-4 py-3">
          <div v-for="n in columns" :key="n" class="h-4 flex-1 rounded bg-slate-100" />
        </div>
      </div>

      <div v-else-if="variant === 'cards'" class="grid gap-4" :class="gridClass">
        <div v-for="n in count" :key="n" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div class="h-3 w-1/3 rounded bg-slate-100" />
          <div class="mt-3 h-7 w-1/2 rounded bg-slate-100" />
        </div>
      </div>

      <div v-else class="space-y-3">
        <div v-for="n in rows" :key="n" class="h-4 rounded bg-slate-100" :style="{ width: lineWidth(n) }" />
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'text' | 'table' | 'cards'
  rows?: number
  columns?: number
  count?: number
  gridClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  rows: 4,
  columns: 5,
  count: 4,
  gridClass: 'md:grid-cols-2 xl:grid-cols-4',
})

function lineWidth(index: number) {
  const widths = ['100%', '85%', '70%', '60%', '90%', '75%', '80%', '65%']
  return widths[(index - 1) % widths.length]
}
</script>
