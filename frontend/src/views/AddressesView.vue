<template>
  <AppShell>
    <section class="space-y-6">
      <div class="space-y-1">
        <h1 class="page-title">地址</h1>
        <p class="page-subtitle">先生成临时邮箱，再按完整域名和项目名筛选、查看或删除。</p>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_320px]">
        <form class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" @submit.prevent="submitCreate">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">生成临时邮箱</h2>
            <p class="mt-1 text-sm text-slate-500">地址页直接创建地址。根域名初始化后就能直接收件，子域名是按项目隔离时的扩展选项。</p>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="block space-y-2 text-sm text-slate-600">
              <span>域名</span>
              <select
                v-model="createForm.domain"
                class="input-base"
                :disabled="createSubmitting || domainsLoading || availableDomains.length === 0"
              >
                <option value="" disabled>
                  {{ domainsLoading ? '加载可用域名...' : availableDomains.length === 0 ? '暂无可用域名' : '请选择域名' }}
                </option>
                <option v-for="item in availableDomains" :key="item.id" :value="item.name">{{ item.name }}</option>
              </select>
            </label>

            <label class="block space-y-2 text-sm text-slate-600">
              <span>本地部分</span>
              <input v-model="createForm.localPart" class="input-base" type="text" placeholder="留空自动生成" :disabled="createSubmitting" />
            </label>

            <label class="block space-y-2 text-sm text-slate-600">
              <span>项目名</span>
              <input v-model="createForm.project" class="input-base" type="text" placeholder="例如 register-bot" :disabled="createSubmitting" />
            </label>

            <label class="block space-y-2 text-sm text-slate-600">
              <span>TTL</span>
              <select v-model.number="createForm.ttlHours" class="input-base" :disabled="createSubmitting">
                <option :value="1">1 小时</option>
                <option :value="6">6 小时</option>
                <option :value="24">24 小时</option>
                <option :value="72">72 小时</option>
                <option :value="0">永久</option>
              </select>
            </label>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              class="button-primary whitespace-nowrap"
              type="submit"
              :disabled="createSubmitting || domainsLoading || availableDomains.length === 0"
            >
              {{ createSubmitting ? '生成中...' : '生成临时邮箱' }}
            </button>
            <button v-if="availableDomains.length === 0" class="button-secondary whitespace-nowrap" type="button" @click="goToDomains">
              去域名页
            </button>
            <button v-if="domainsError" class="button-secondary whitespace-nowrap" type="button" @click="reloadDomains">
              重试加载域名
            </button>
          </div>

          <p v-if="domainsError" class="text-sm text-rose-600">{{ domainsError }}</p>
          <p v-else-if="!domainsLoading && availableDomains.length === 0" class="text-sm text-rose-600">
            当前还没有可用域名。先去域名页初始化根域名；如果你想按项目分隔收件，再额外创建子域名。
          </p>
          <p v-if="createError" class="text-sm text-rose-600">{{ createError }}</p>
          <p v-if="copyMessage" class="text-sm text-slate-500">{{ copyMessage }}</p>
        </form>

        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <template v-if="createResult">
            <div class="space-y-4">
              <div>
                <p class="text-sm text-slate-500">最近一次生成结果</p>
                <p class="mt-2 break-all text-base font-medium text-slate-900">{{ createResult.address }}</p>
              </div>
              <div class="space-y-2 text-sm text-slate-600">
                <p>项目：{{ createResult.project }}</p>
                <p>TTL：{{ formatTtlHours(createResult.ttlHours) }}</p>
                <p :class="statusClass(createResult.status)">{{ statusLabel(createResult.status) }}</p>
              </div>
              <div class="flex flex-col gap-3">
                <button class="button-secondary" type="button" @click="copyCreatedAddress">复制地址</button>
                <button class="button-primary" type="button" @click="goToMails(createResult.address)">查看邮件</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="space-y-3 text-sm text-slate-500">
              <p>最近一次生成结果会显示在这里。</p>
              <p>成功后可以直接复制地址，或者跳到邮件页查看收件情况。</p>
            </div>
          </template>
        </div>
      </div>

      <div class="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-slate-900">地址列表</h2>
          <p class="text-sm text-slate-500">按完整域名和项目名精确筛选，直接查看邮件或删除。</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <input v-model="filters.domain" class="input-base" type="text" placeholder="按完整域名筛选" />
          <input v-model="filters.project" class="input-base" type="text" placeholder="按项目名筛选" />
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

      <p v-if="listError" class="text-sm text-rose-600">{{ listError }}</p>
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

import { ApiError } from '../api/client'
import { createAddress, deleteAdminAddress, getAddresses, getDomains, type AddressCreateResult } from '../api/admin'
import AppShell from '../components/AppShell.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import type { AddressRecord, ApiEnvelope, DomainRecord, PaginationMeta } from '../types'
import { useSWR } from '../composables/useSWR'
import { useAuthStore } from '../stores/auth'

const LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/

const router = useRouter()
const authStore = useAuthStore()
const filters = reactive({ domain: '', project: '' })
const createForm = reactive({ domain: '', localPart: '', project: '', ttlHours: 24 })
const pendingDelete = ref('')
const currentPage = ref(1)
const createSubmitting = ref(false)
const createError = ref('')
const copyMessage = ref('')
const createResult = ref<{
  status: AddressCreateResult['status']
  address: string
  project: string
  ttlHours: number
} | null>(null)
const pageSize = 20

type AddressResult = ApiEnvelope<{ items: AddressRecord[]; pagination: PaginationMeta }>

const { data, error: listError, isLoading, mutate } = useSWR<AddressResult>({
  key: () => `addresses:${currentPage.value}:${filters.domain}:${filters.project}`,
  fetcher: () => {
    const params = new URLSearchParams({ page: String(currentPage.value), size: String(pageSize) })
    if (filters.domain) params.set('domain', filters.domain)
    if (filters.project) params.set('project', filters.project)
    return getAddresses(authStore.token, params)
  },
  watchSources: [() => filters.domain, () => filters.project, currentPage],
})

const {
  data: domainsData,
  error: domainsError,
  isLoading: domainsLoading,
  mutate: reloadDomains,
} = useSWR<ApiEnvelope<DomainRecord[]>>({
  key: 'address-create-domains:all',
  fetcher: () => getDomains(authStore.token),
})

const items = computed(() => data.value?.data?.items ?? [])
const pagination = computed(() => data.value?.data?.pagination ?? { page: 1, size: pageSize, total: 0, totalPages: 1 })
const availableDomains = computed(() => domainsData.value?.data ?? [])

watch(() => [filters.domain, filters.project], () => {
  currentPage.value = 1
})

watch(
  availableDomains,
  (domains) => {
    if (domains.length === 0) {
      createForm.domain = ''
      return
    }

    if (!domains.some((item) => item.name === createForm.domain)) {
      createForm.domain = domains[0].name
    }
  },
  { immediate: true },
)

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

function formatTtlHours(value: number) {
  return value === 0 ? '永久' : `${value} 小时`
}

function statusLabel(status: AddressCreateResult['status']) {
  switch (status) {
    case 'created':
      return '已新建'
    case 'occupied':
      return '当前项目已存在这个地址'
    case 'available':
      return '这个地址已被其他项目占用'
  }
}

function statusClass(status: AddressCreateResult['status']) {
  return status === 'available' ? 'text-rose-600' : 'text-slate-900'
}

function goToMails(address: string) {
  router.push({ name: 'mails', query: { address } })
}

function goToDomains() {
  router.push({ name: 'domains' })
}

function openDelete(address: string) {
  pendingDelete.value = address
}

function generateLocalPart() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function normalizeLocalPart(value: string) {
  return value.trim().toLowerCase()
}

async function submitCreate() {
  createError.value = ''
  copyMessage.value = ''

  const domain = createForm.domain.trim()
  const project = createForm.project.trim()
  const localPart = normalizeLocalPart(createForm.localPart) || generateLocalPart()

  if (!domain) {
    createError.value = '请选择域名'
    return
  }

  if (!project) {
    createError.value = '请输入项目名'
    return
  }

  if (!LOCAL_PART_PATTERN.test(localPart)) {
    createError.value = '本地部分只能包含字母、数字、.、_、-'
    return
  }

  createSubmitting.value = true

  try {
    const address = `${localPart}@${domain}`
    const response = await createAddress(authStore.token, address, project, createForm.ttlHours)
    createResult.value = {
      status: response.data.status,
      address: response.data.address.name,
      project: response.data.address.project,
      ttlHours: response.data.address.ttl_hours,
    }
    createForm.localPart = ''
    createForm.project = project
    createForm.ttlHours = 24

    const shouldRefreshDirectly = currentPage.value === 1
    currentPage.value = 1
    if (shouldRefreshDirectly) {
      await mutate()
    }
  } catch (error) {
    createError.value = error instanceof ApiError ? error.message : '创建地址失败'
  } finally {
    createSubmitting.value = false
  }
}

async function copyCreatedAddress() {
  if (!createResult.value) return

  try {
    await navigator.clipboard.writeText(createResult.value.address)
    copyMessage.value = '已复制到剪贴板'
  } catch {
    copyMessage.value = '复制失败，请手动复制'
  }
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
