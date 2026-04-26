<template>
  <AppShell>
    <section class="space-y-8">
      <div class="space-y-1">
        <h1 class="page-title">域名</h1>
        <p class="page-subtitle">先初始化根域名，再创建长期或临时子域名。长期子域名不会被轮换删除。</p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <form class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" @submit.prevent="submitBootstrap">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">根域名初始化</h2>
            <p class="mt-1 text-sm text-slate-500">启用 Email Routing，把根域名 catch-all 指到 Worker，并保存根域名状态。初始化后可以直接创建 `abc@根域名` 这样的地址。</p>
          </div>
          <input v-model="bootstrapForm.rootDomain" class="input-base" type="text" placeholder="ainiaini.xyz" />
          <button class="button-primary" type="submit">初始化根域名</button>
        </form>

        <form class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" @submit.prevent="submitSubdomain">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">新增子域名</h2>
            <p class="mt-1 text-sm text-slate-500">长期子域名独立保留；临时子域名按根域名轮换，达到设置里的轮换总数后只回收最早临时项。</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <input v-model="createForm.name" class="input-base" type="text" placeholder="m1.ainiaini.xyz" />
            <select v-model="createForm.subdomainType" class="input-base">
              <option value="permanent">长期子域名</option>
              <option value="temporary">临时子域名</option>
            </select>
          </div>
          <button class="button-primary" type="submit">创建子域名</button>
        </form>
      </div>

      <div class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-slate-900">域名管理</h2>
            <p class="text-sm text-slate-500">按名称查找，按类型和根域名筛选，再按根域名分组查看和批量删除子域名。</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
            <input v-model="filters.query" class="input-base" type="text" placeholder="按域名名称查找" />
            <select v-model="filters.root" class="input-base">
              <option value="all">全部根域名</option>
              <option v-for="item in rootDomains" :key="item.id" :value="item.name">{{ item.name }}</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in typeOptions"
              :key="option.value"
              type="button"
              class="inline-flex items-center rounded-full px-3 py-1.5 text-sm transition"
              :class="filters.type === option.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              @click="filters.type = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="text-slate-500">当前显示 {{ filteredSubdomainNames.length }} 个子域名，已选 {{ selectedNames.length }} 个。</span>
            <button
              class="button-secondary h-9 px-3"
              type="button"
              :disabled="filteredSubdomainNames.length === 0"
              @click="toggleSelectAllVisible"
            >
              {{ allVisibleSelected ? '取消全选当前结果' : '全选当前结果' }}
            </button>
            <button class="button-secondary h-9 px-3" type="button" :disabled="selectedNames.length === 0" @click="selectedNames = []">
              清空选择
            </button>
            <button class="button-danger h-9 px-3" type="button" :disabled="selectedNames.length === 0" @click="openBatchDelete">
              批量删除子域名
            </button>
          </div>
        </div>

        <SkeletonLoader v-if="isLoading" variant="table" :rows="5" :columns="6" />

        <template v-else>
          <div class="overflow-hidden rounded-2xl ring-1 ring-slate-200/70">
            <div v-if="domainGroups.length === 0" class="px-6 py-12 text-center text-sm text-slate-500">
              当前筛选条件下没有域名。
            </div>

            <div v-for="group in domainGroups" :key="group.root.id" class="border-t border-slate-200 first:border-t-0">
              <div class="flex flex-col gap-3 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-sm font-semibold text-slate-900">{{ group.root.name }}</h3>
                    <span class="rounded-full bg-white px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">根域名</span>
                    <span class="rounded-full bg-white px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                      长期 {{ group.root.permanent_subdomain_count ?? 0 }} / 临时 {{ group.root.temporary_subdomain_count ?? 0 }}
                    </span>
                    <span class="rounded-full bg-white px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                      DNS 剩余 {{ group.root.remaining_dns_count ?? 0 }} / 可管理 {{ group.root.manageable_dns_count ?? 0 }}
                    </span>
                  </div>
                  <p class="text-sm text-slate-500">已管理 DNS {{ group.root.managed_dns_count ?? 0 }} 条；轮换总数 {{ group.root.subdomain_rotation_limit ?? 0 }} 个/根域名。</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="group.subdomains.length > 0"
                    class="button-secondary h-9 px-3"
                    type="button"
                    @click="toggleGroupSelection(group.subdomains)"
                  >
                    {{ areAllSelected(group.subdomains) ? '取消选择这一组' : '选择这一组' }}
                  </button>
                </div>
              </div>

              <div class="divide-y divide-slate-100">
                <div
                  v-if="group.rootVisible"
                  class="grid gap-3 px-4 py-4 sm:grid-cols-[28px_minmax(0,1.5fr)_90px_130px_180px_110px] sm:items-center"
                >
                  <div class="flex items-center justify-center">
                    <span class="h-4 w-4 rounded border border-transparent" aria-hidden="true"></span>
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-slate-900">{{ group.root.name }}</p>
                    <p class="mt-1 text-sm text-slate-500">当前根域名的收件入口已经初始化完成。</p>
                  </div>
                  <div>
                    <span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">根域名</span>
                  </div>
                  <div class="text-sm text-slate-500">Routing：{{ group.root.routing_enabled === 1 ? '已启用' : '未启用' }}</div>
                  <div class="text-sm text-slate-500">创建时间：{{ formatDate(group.root.created_at) }}</div>
                  <div></div>
                </div>

                <div
                  v-for="item in group.subdomains"
                  :key="item.id"
                  class="grid gap-3 px-4 py-4 sm:grid-cols-[28px_minmax(0,1.5fr)_90px_130px_180px_110px] sm:items-center"
                >
                  <label class="flex items-center justify-center">
                    <input
                      class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      type="checkbox"
                      :checked="selectedNames.includes(item.name)"
                      @change="toggleSelection(item.name)"
                    />
                  </label>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-slate-900">{{ item.name }}</p>
                    <p class="mt-1 text-sm text-slate-500">归属根域名：{{ item.root_name }}；DNS {{ item.managed_dns_count ?? 0 }} 条</p>
                  </div>
                  <div>
                    <span class="rounded-full px-2 py-1 text-xs" :class="subdomainTypeClass(item.subdomain_type)">
                      {{ subdomainTypeLabel(item.subdomain_type) }}
                    </span>
                  </div>
                  <div class="text-sm text-slate-500">Routing：{{ item.routing_enabled === 1 ? '已启用' : '未启用' }}</div>
                  <div class="text-sm text-slate-500">创建时间：{{ formatDate(item.created_at) }}</div>
                  <div class="flex justify-end">
                    <button class="button-danger h-9 px-3" type="button" @click="openSingleDelete(item.name)">删除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <p v-if="message" class="text-sm text-slate-500">{{ message }}</p>
        <p v-if="actionError" class="text-sm text-rose-600">{{ actionError }}</p>
        <p v-if="loadError" class="text-sm text-rose-600">{{ loadError }}</p>
      </div>
    </section>

    <ConfirmModal
      :open="pendingDeleteNames.length > 0"
      :title="pendingDeleteNames.length > 1 ? '批量删除子域名' : '删除子域名'"
      :message="deleteConfirmMessage"
      confirm-label="确认删除"
      destructive
      @cancel="pendingDeleteNames = []"
      @confirm="confirmDelete"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { ApiError } from '../api/client'
import { batchDeleteDomains, bootstrapDomain, createSubdomain, deleteDomain, getDomains } from '../api/admin'
import type { SubdomainType } from '../api/admin'
import AppShell from '../components/AppShell.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import type { ApiEnvelope, DomainRecord } from '../types'
import { useSWR } from '../composables/useSWR'
import { useAuthStore } from '../stores/auth'

type DomainFilterType = 'all' | 'root' | SubdomainType

type DomainGroup = {
  root: DomainRecord
  rootVisible: boolean
  subdomains: DomainRecord[]
}

const authStore = useAuthStore()
const bootstrapForm = reactive({ rootDomain: '' })
const createForm = reactive<{ name: string; subdomainType: SubdomainType }>({
  name: '',
  subdomainType: 'permanent',
})
const filters = reactive<{ query: string; type: DomainFilterType; root: string }>({
  query: '',
  type: 'all',
  root: 'all',
})
const selectedNames = ref<string[]>([])
const pendingDeleteNames = ref<string[]>([])
const message = ref('')
const actionError = ref('')

const typeOptions: Array<{ value: DomainFilterType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'root', label: '根域名' },
  { value: 'permanent', label: '长期子域名' },
  { value: 'temporary', label: '临时子域名' },
]

const { data, error: loadError, isLoading, mutate } = useSWR<ApiEnvelope<DomainRecord[]>>({
  key: 'domains',
  fetcher: () => getDomains(authStore.token),
})

const domains = computed(() => data.value?.data ?? [])
const rootDomains = computed(() => domains.value.filter((item) => item.is_root === 1))
const normalizedQuery = computed(() => filters.query.trim().toLowerCase())

const filteredRootDomains = computed(() => {
  const query = normalizedQuery.value

  return rootDomains.value.filter((item) => {
    if (filters.root !== 'all' && item.name !== filters.root) {
      return false
    }

    if (filters.type === 'permanent' || filters.type === 'temporary') {
      return false
    }

    if (!query) {
      return true
    }

    return item.name.includes(query)
  })
})

const filteredSubdomains = computed(() => {
  const query = normalizedQuery.value

  return domains.value.filter((item) => {
    if (item.is_root === 1) {
      return false
    }

    if (filters.type === 'root') {
      return false
    }

    if ((filters.type === 'permanent' || filters.type === 'temporary') && item.subdomain_type !== filters.type) {
      return false
    }

    if (filters.root !== 'all' && item.root_name !== filters.root) {
      return false
    }

    if (!query) {
      return true
    }

    return item.name.includes(query) || item.root_name.includes(query)
  })
})

const filteredSubdomainNames = computed(() => filteredSubdomains.value.map((item) => item.name))

const domainGroups = computed<DomainGroup[]>(() => {
  const visibleRootNames = new Set<string>()
  const groups: DomainGroup[] = []

  for (const item of filteredRootDomains.value) {
    visibleRootNames.add(item.name)
    groups.push({
      root: item,
      rootVisible: true,
      subdomains: filteredSubdomains.value.filter((subdomain) => subdomain.root_name === item.name),
    })
  }

  for (const item of filteredSubdomains.value) {
    if (visibleRootNames.has(item.root_name)) {
      continue
    }

    const root = rootDomains.value.find((rootItem) => rootItem.name === item.root_name)
    if (!root) {
      continue
    }

    visibleRootNames.add(root.name)
    groups.push({
      root,
      rootVisible: false,
      subdomains: filteredSubdomains.value.filter((subdomain) => subdomain.root_name === root.name),
    })
  }

  return groups
})

const allVisibleSelected = computed(() => (
  filteredSubdomainNames.value.length > 0
    && filteredSubdomainNames.value.every((name) => selectedNames.value.includes(name))
))

const deleteConfirmMessage = computed(() => (
  pendingDeleteNames.value.length > 1
    ? `删除这 ${pendingDeleteNames.value.length} 个子域名后，对应的 Cloudflare 记录和规则也会一起删除。`
    : `删除 ${pendingDeleteNames.value[0] ?? ''} 后，对应的 Cloudflare 记录和规则也会一起删除。`
))

watch(rootDomains, (items) => {
  if (filters.root !== 'all' && !items.some((item) => item.name === filters.root)) {
    filters.root = 'all'
  }
}, { immediate: true })

watch(domains, (items) => {
  const validNames = new Set(items.filter((item) => item.is_root !== 1).map((item) => item.name))
  selectedNames.value = selectedNames.value.filter((name) => validNames.has(name))
}, { immediate: true })

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

function subdomainTypeLabel(value: DomainRecord['subdomain_type']) {
  if (value === 'temporary') {
    return '临时'
  }

  if (value === 'permanent') {
    return '长期'
  }

  return '根域名'
}

function subdomainTypeClass(value: DomainRecord['subdomain_type']) {
  return value === 'temporary'
    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
}

function areAllSelected(items: DomainRecord[]) {
  return items.length > 0 && items.every((item) => selectedNames.value.includes(item.name))
}

function toggleSelection(name: string) {
  if (selectedNames.value.includes(name)) {
    selectedNames.value = selectedNames.value.filter((item) => item !== name)
    return
  }

  selectedNames.value = [...selectedNames.value, name]
}

function toggleGroupSelection(items: DomainRecord[]) {
  const names = items.map((item) => item.name)
  const shouldClear = names.every((name) => selectedNames.value.includes(name))

  if (shouldClear) {
    selectedNames.value = selectedNames.value.filter((name) => !names.includes(name))
    return
  }

  selectedNames.value = Array.from(new Set([...selectedNames.value, ...names]))
}

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    selectedNames.value = selectedNames.value.filter((name) => !filteredSubdomainNames.value.includes(name))
    return
  }

  selectedNames.value = Array.from(new Set([...selectedNames.value, ...filteredSubdomainNames.value]))
}

function openSingleDelete(name: string) {
  pendingDeleteNames.value = [name]
}

function openBatchDelete() {
  pendingDeleteNames.value = [...selectedNames.value]
}

async function submitBootstrap() {
  message.value = ''
  actionError.value = ''

  try {
    const response = await bootstrapDomain(authStore.token, bootstrapForm.rootDomain)
    message.value = `根域名 ${response.data.name} 已初始化，现在可以直接创建 abc@${response.data.name} 这样的地址。`
    bootstrapForm.rootDomain = ''
    await mutate()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : '初始化根域名失败'
  }
}

async function submitSubdomain() {
  message.value = ''
  actionError.value = ''

  try {
    const response = await createSubdomain(authStore.token, createForm.name, createForm.subdomainType)
    message.value = `${subdomainTypeLabel(response.data.subdomain_type)}子域名 ${response.data.name} 已创建，归属于根域名 ${response.data.root_name}。`
    createForm.name = ''
    await mutate()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : '创建子域名失败'
  }
}

async function confirmDelete() {
  if (pendingDeleteNames.value.length === 0) {
    return
  }

  message.value = ''
  actionError.value = ''

  try {
    if (pendingDeleteNames.value.length === 1) {
      await deleteDomain(authStore.token, pendingDeleteNames.value[0])
      message.value = `子域名 ${pendingDeleteNames.value[0]} 已删除。`
      selectedNames.value = selectedNames.value.filter((name) => name !== pendingDeleteNames.value[0])
    } else {
      const response = await batchDeleteDomains(authStore.token, pendingDeleteNames.value)
      const deletedCount = response.data.deleted.length
      const skippedCount = response.data.skippedRoots.length + response.data.skippedMissing.length
      message.value = skippedCount > 0
        ? `已删除 ${deletedCount} 个子域名，跳过 ${skippedCount} 个不符合条件的域名。`
        : `已删除 ${deletedCount} 个子域名。`
      selectedNames.value = selectedNames.value.filter((name) => !response.data.deleted.includes(name))
    }

    pendingDeleteNames.value = []
    await mutate()
  } catch (err) {
    actionError.value = err instanceof ApiError ? err.message : '删除域名失败'
  }
}
</script>
