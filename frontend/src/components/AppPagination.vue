<template>
  <div class="flex flex-col gap-3 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
    <p>
      第 {{ pagination.page }} / {{ pagination.totalPages }} 页，共 {{ pagination.total }} 条
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <button class="button-secondary h-9 px-3" type="button" :disabled="!canGoPrevious" @click="emitPage(1)">
        首页
      </button>
      <button class="button-secondary h-9 px-3" type="button" :disabled="!canGoPrevious" @click="emitPage(pagination.page - 1)">
        上一页
      </button>

      <div class="flex items-center gap-1">
        <template v-for="(item, index) in pageItems" :key="`${item}-${index}`">
          <span v-if="item === 'ellipsis'" class="flex h-9 min-w-9 items-center justify-center px-2 text-slate-400">...</span>
          <button
            v-else
            class="inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium ring-1 ring-slate-200 transition"
            :class="item === pagination.page ? 'bg-slate-900 text-white ring-slate-900' : 'text-slate-700 hover:bg-slate-50'"
            type="button"
            :aria-current="item === pagination.page ? 'page' : undefined"
            @click="emitPage(item)"
          >
            {{ item }}
          </button>
        </template>
      </div>

      <button class="button-secondary h-9 px-3" type="button" :disabled="!canGoNext" @click="emitPage(pagination.page + 1)">
        下一页
      </button>
      <button class="button-secondary h-9 px-3" type="button" :disabled="!canGoNext" @click="emitPage(pagination.totalPages)">
        末页
      </button>

      <form class="flex items-center gap-2" @submit.prevent="submitJump">
        <label class="sr-only" :for="inputId">跳转页码</label>
        <input
          :id="inputId"
          v-model="pageInput"
          class="input-base h-9 w-20 px-2 text-center"
          type="number"
          inputmode="numeric"
          min="1"
          :max="pagination.totalPages"
          :disabled="pagination.totalPages <= 1"
          @blur="syncInput"
        />
        <button class="button-secondary h-9 px-3" type="submit" :disabled="pagination.totalPages <= 1">
          跳转
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PaginationMeta } from '../types'

import { buildPaginationItems, clampPage } from '../lib/pagination'

const props = defineProps<{
  pagination: PaginationMeta
}>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const pageInput = ref(String(props.pagination.page))
const inputId = `pagination-page-${Math.random().toString(36).slice(2)}`

const pageItems = computed(() => buildPaginationItems(props.pagination.page, props.pagination.totalPages))
const canGoPrevious = computed(() => props.pagination.page > 1)
const canGoNext = computed(() => props.pagination.page < props.pagination.totalPages)

watch(() => props.pagination.page, syncInput)

function emitPage(page: number) {
  const nextPage = clampPage(page, props.pagination.totalPages)
  if (nextPage !== props.pagination.page) {
    emit('update:page', nextPage)
  }
}

function submitJump() {
  emitPage(Number.parseInt(pageInput.value, 10))
  syncInput()
}

function syncInput() {
  pageInput.value = String(props.pagination.page)
}
</script>
