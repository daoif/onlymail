<template>
  <AppShell>
    <section class="space-y-6">
      <div class="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-1">
          <h1 class="page-title">地址</h1>
          <p class="page-subtitle">按域名和项目筛选邮箱地址，直接查看邮件或删除。</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <input v-model="filters.domain" class="input-base" type="text" placeholder="筛选域名" />
          <input v-model="filters.project" class="input-base" type="text" placeholder="筛选项目" />
        </div>
      </div>

      <SkeletonLoader v-if="isLoading" variant="table" :rows="6" :columns="7" />

      <template v-else>
        <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">邮箱地址</th>
                <th class="px-4 py-3 font-medium">域名</th>
                <th class="px-4 py-3 font-medium">项目</th>
                <th class="px-4 py-3 font-medium">TTL</th>
                <th class="px-4 py-3 font-medium">邮件数</th>
                <th class="px-4 py-3 font-medium">创建时间</th>
                <th class="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in items" :key="item.id">
                <td class="px-4 py-3 text-slate-900">{{ item.name }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.domain }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.project }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.ttl_hours === 0 ? '永久' : `${item.ttl_hours}h` }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.mail_count ?? 0 }}</td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(item.created_at) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button class="button-secondary" type="button" @click="goToMails(item.name)">查看邮件</button>
                    <button class="button-danger" type="button" @click="openDelete(item.name)">删除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="7" class="px-4 py-12 text-center text-slate-500">暂无地址</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between text-sm text-slate-500">
          <p>第 {{ pagination.page }} / {{ pagination.totalPages }} 页，共 {{ pagination.total }} 条</p>
          <div class="flex gap-2">
            <button class="button-secondary" type="button" :disabled="pagination.page <= 1" @click="changePage(-1)">上一页</button>
            <button class="button-secondary" type="button" :disabled="pagination.page >= pagination.totalPages" @click="changePage(1)">下一页</button>
          </div>
        </div>
      </template>

      <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
    </section>

    <ConfirmModal
      :open="Boolean(pendingDelete)"
      title="删除邮箱地址"
      :message="`删除 ${pendingDelete ?? ''} 后，关联邮件也会一起删除。`"
      confirm-label="确认删除"
      destructive
      @cancel="pendingDelete = ''"
      @confirm="confirmDelete"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { deleteAdminAddress, getAddresses } from '../api/admin'
import AppShell from '../components/AppShell.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import type { AddressRecord, ApiEnvelope, PaginationMeta } from '../types'
import { useSWR } from '../composables/useSWR'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const filters = reactive({ domain: '', project: '' })
const pendingDelete = ref('')
const currentPage = ref(1)
const pageSize = 20

type AddressResult = ApiEnvelope<{ items: AddressRecord[]; pagination: PaginationMeta }>

const { data, error, isLoading, mutate } = useSWR<AddressResult>({
  key: () => `addresses:${currentPage.value}:${filters.domain}:${filters.project}`,
  fetcher: () => {
    const params = new URLSearchParams({ page: String(currentPage.value), size: String(pageSize) })
    if (filters.domain) params.set('domain', filters.domain)
    if (filters.project) params.set('project', filters.project)
    return getAddresses(authStore.token, params)
  },
  watchSources: [() => filters.domain, () => filters.project, currentPage],
})

const items = computed(() => data.value?.data?.items ?? [])
const pagination = computed(() => data.value?.data?.pagination ?? { page: 1, size: pageSize, total: 0, totalPages: 1 })

watch(() => [filters.domain, filters.project], () => {
  currentPage.value = 1
})

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

function goToMails(address: string) {
  router.push({ name: 'mails', query: { address } })
}

function openDelete(address: string) {
  pendingDelete.value = address
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  await deleteAdminAddress(authStore.token, pendingDelete.value)
  pendingDelete.value = ''
  await mutate()
}

function changePage(step: number) {
  currentPage.value += step
}
</script>
