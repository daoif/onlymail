<template>
  <AppShell>
    <section class="space-y-8">
      <div class="space-y-1">
        <h1 class="page-title">域名</h1>
        <p class="page-subtitle">先初始化根域名让它能直接收件，再按需要创建和删除收件子域名。</p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <form class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" @submit.prevent="submitBootstrap">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">根域名初始化</h2>
            <p class="mt-1 text-sm text-slate-500">启用 Email Routing，把根域名 catch-all 指到 Worker，并保存根域名状态。初始化后可以直接创建 `abc@根域名` 这样的地址。</p>
          </div>
          <input v-model="bootstrapForm.rootDomain" class="input-base" type="text" placeholder="root.example.com" />
          <button class="button-primary" type="submit">初始化根域名</button>
        </form>

        <form class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" @submit.prevent="submitSubdomain">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">新增子域名</h2>
            <p class="mt-1 text-sm text-slate-500">给这个子域名补齐 3 条 MX、1 条 TXT 和 1 条 Email Routing 规则，让它也能独立收件。</p>
          </div>
          <input v-model="createForm.name" class="input-base" type="text" placeholder="m1.example.com" />
          <input v-model="createForm.rootName" class="input-base" type="text" placeholder="可选：根域名" />
          <button class="button-primary" type="submit">创建子域名</button>
        </form>
      </div>

      <SkeletonLoader v-if="isLoading" variant="table" :rows="4" :columns="6" />

      <template v-else>
        <div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">域名</th>
                <th class="px-4 py-3 font-medium">根域名</th>
                <th class="px-4 py-3 font-medium">类型</th>
                <th class="px-4 py-3 font-medium">Routing</th>
                <th class="px-4 py-3 font-medium">创建时间</th>
                <th class="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in domains" :key="item.id">
                <td class="px-4 py-3 text-slate-900">{{ item.name }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.root_name }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.is_root === 1 ? '根域名' : '子域名' }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.routing_enabled === 1 ? '已启用' : '未启用' }}</td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(item.created_at) }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end">
                    <button v-if="item.is_root !== 1" class="button-danger" type="button" @click="pendingDelete = item.name">删除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="domains.length === 0">
                <td colspan="6" class="px-4 py-12 text-center text-slate-500">还没有初始化域名。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <p v-if="message" class="text-sm text-slate-500">{{ message }}</p>
      <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
    </section>

    <ConfirmModal
      :open="Boolean(pendingDelete)"
      title="删除子域名"
      :message="`删除 ${pendingDelete ?? ''} 后，对应的 Cloudflare 记录和规则会一起删除。`"
      confirm-label="确认删除"
      destructive
      @cancel="pendingDelete = ''"
      @confirm="confirmDelete"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { ApiError } from '../api/client'
import { bootstrapDomain, createSubdomain, deleteDomain, getDomains } from '../api/admin'
import AppShell from '../components/AppShell.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import type { ApiEnvelope, DomainRecord } from '../types'
import { useSWR } from '../composables/useSWR'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const bootstrapForm = reactive({ rootDomain: '' })
const createForm = reactive({ name: '', rootName: '' })
const message = ref('')
const pendingDelete = ref('')

const { data, error, isLoading, mutate } = useSWR<ApiEnvelope<DomainRecord[]>>({
  key: 'domains',
  fetcher: () => getDomains(authStore.token),
})

const domains = computed(() => data.value?.data ?? [])

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

async function submitBootstrap() {
  message.value = ''
  try {
    const response = await bootstrapDomain(authStore.token, bootstrapForm.rootDomain)
    message.value = `根域名 ${response.data.name} 已初始化，现在可以直接创建 ${`abc@${response.data.name}`} 这样的地址。`
    bootstrapForm.rootDomain = ''
    await mutate()
  } catch (err) {
    message.value = err instanceof ApiError ? err.message : '初始化根域名失败'
  }
}

async function submitSubdomain() {
  message.value = ''
  try {
    const response = await createSubdomain(authStore.token, createForm.name, createForm.rootName)
    message.value = `子域名 ${response.data.name} 已创建。`
    createForm.name = ''
    createForm.rootName = ''
    await mutate()
  } catch (err) {
    message.value = err instanceof ApiError ? err.message : '创建子域名失败'
  }
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  await deleteDomain(authStore.token, pendingDelete.value)
  pendingDelete.value = ''
  await mutate()
}
</script>
