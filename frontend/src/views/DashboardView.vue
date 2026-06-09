<template>
  <AppShell>
    <section class="space-y-6">
      <div class="space-y-1">
        <h1 class="page-title">仪表盘</h1>
        <p class="page-subtitle">查看当前地址、邮件和域名的整体状态。</p>
      </div>

      <SkeletonLoader v-if="isLoading" variant="cards" :count="4" />
      <SkeletonLoader v-if="isLoading" variant="cards" :count="2" grid-class="xl:grid-cols-[minmax(0,1fr)_360px]" />

      <template v-else>
        <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="总地址数" :value="stats.totalAddresses" />
          <StatCard label="总邮件数" :value="stats.totalMails" />
          <StatCard label="已配置域名数" :value="stats.totalDomains" />
          <StatCard label="今日新邮件数" :value="stats.todayMailCount" />
        </div>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-slate-900">D1 容量</h2>
                <p class="text-sm text-slate-500">
                  当前数据库占用 {{ stats.d1Capacity.sizeLabel }} / {{ stats.d1Capacity.limitLabel }}，剩余 {{ stats.d1Capacity.remainingLabel }}。
                </p>
              </div>
              <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1" :class="capacityStatusClass">
                {{ capacityStatusLabel }}
              </span>
            </div>

            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all duration-150"
                :class="capacityBarClass"
                :style="{ width: `${Math.min(stats.d1Capacity.usagePercent, 100)}%` }"
              />
            </div>

            <div class="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3">
              <div class="space-y-1">
                <p class="text-sm text-slate-500">当前占用</p>
                <p class="text-base font-medium text-slate-900">{{ stats.d1Capacity.sizeLabel }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-sm text-slate-500">剩余空间</p>
                <p class="text-base font-medium text-slate-900">{{ stats.d1Capacity.remainingLabel }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-sm text-slate-500">占用率</p>
                <p class="text-base font-medium text-slate-900">{{ formatPercent(stats.d1Capacity.usagePercent) }}</p>
              </div>
            </div>
          </section>

          <section class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-slate-900">清理操作</h2>
              <p class="text-sm text-slate-500">清理邮件只删收件记录；清理邮箱会连同地址一起删除。按临时 / 永久分开。</p>
            </div>

            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="action in cleanupActions"
                :key="action.key"
                class="button-danger h-10 w-full"
                type="button"
                :disabled="cleanupSubmittingKey === action.key"
                @click="openCleanupConfirm(action)"
              >
                {{ cleanupSubmittingKey === action.key ? '执行中…' : action.label }}
              </button>
            </div>

            <p class="text-xs text-slate-500">
              先清理邮件，再清理邮箱。清理邮箱会删地址和对应邮件，操作前会再次确认。
            </p>
            <p v-if="cleanupMessage" class="text-sm text-slate-500">{{ cleanupMessage }}</p>
            <p v-if="cleanupError" class="text-sm text-rose-600">{{ cleanupError }}</p>

            <div class="space-y-3 border-t border-slate-200 pt-4">
              <SkeletonLoader v-if="autoCleanupLoading" variant="text" :rows="2" />
              <template v-else>
                <label class="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    v-model="autoCleanupEnabledInput"
                    class="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    type="checkbox"
                  />
                  <span>
                    <span class="block font-medium text-slate-900">容量达到 {{ autoCleanupSettings.triggerUsagePercent }}% 后自动滚动删除临时邮箱与临时邮件</span>
                    <span class="mt-1 block text-xs text-slate-500">
                      触发后只保留最近活跃的 {{ autoCleanupSettings.keepTemporaryAddresses }} 个临时邮箱及其邮件，永久邮箱和永久邮件不受影响。
                    </span>
                  </span>
                </label>
                <button class="button-primary h-9 w-full" type="button" :disabled="autoCleanupSubmitting" @click="submitAutoCleanupSettings">
                  {{ autoCleanupSubmitting ? '保存中…' : '保存设置' }}
                </button>
              </template>
              <p v-if="autoCleanupMessage" class="text-sm text-slate-500">{{ autoCleanupMessage }}</p>
              <p v-if="autoCleanupError || autoCleanupLoadError" class="text-sm text-rose-600">
                {{ autoCleanupError || autoCleanupLoadError }}
              </p>
            </div>
          </section>
        </div>
      </template>
    </section>

    <ConfirmModal
      :open="Boolean(pendingCleanup)"
      :title="pendingCleanup?.title || '确认清理'"
      :message="pendingCleanup?.message || ''"
      confirm-label="确认清理"
      destructive
      @cancel="cancelCleanup"
      @confirm="confirmCleanup"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { cleanupDashboardD1, getD1AutoCleanupSettings, getDashboard, updateD1AutoCleanupSettings } from '../api/admin'
import AppShell from '../components/AppShell.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import StatCard from '../components/StatCard.vue'
import { useSWR } from '../composables/useSWR'
import { useAuthStore } from '../stores/auth'
import type { ApiEnvelope, D1AutoCleanupSettings, DashboardStats, D1CleanupResult } from '../types'

const authStore = useAuthStore()

const defaultDashboardStats: DashboardStats = {
  totalAddresses: 0,
  totalMails: 0,
  totalDomains: 0,
  todayMailCount: 0,
  d1Capacity: {
    sizeBytes: 0,
    sizeLabel: '0 MB',
    limitBytes: 500_000_000,
    limitLabel: '500 MB',
    remainingBytes: 500_000_000,
    remainingLabel: '500 MB',
    usagePercent: 0,
    status: 'normal',
  },
}

const { data, error, isLoading, mutate } = useSWR<ApiEnvelope<DashboardStats>>({
  key: 'dashboard',
  fetcher: () => getDashboard(authStore.token),
})

const {
  data: autoCleanupData,
  error: autoCleanupLoadError,
  isLoading: autoCleanupLoading,
  mutate: mutateAutoCleanup,
} = useSWR<ApiEnvelope<D1AutoCleanupSettings>>({
  key: 'dashboard-d1-auto-cleanup',
  fetcher: () => getD1AutoCleanupSettings(authStore.token),
})

const stats = computed(() => data.value?.data ?? defaultDashboardStats)
const autoCleanupSettings = computed(() => autoCleanupData.value?.data ?? {
  enabled: false,
  triggerUsagePercent: 95,
  keepTemporaryAddresses: 100,
})
const capacityStatusLabel = computed(() => {
  switch (stats.value.d1Capacity.status) {
    case 'danger':
      return '已超限'
    case 'warning':
      return '接近上限'
    default:
      return '正常'
  }
})
const capacityStatusClass = computed(() => {
  switch (stats.value.d1Capacity.status) {
    case 'danger':
      return 'bg-rose-50 text-rose-700 ring-rose-200'
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-200'
  }
})
const capacityBarClass = computed(() => {
  switch (stats.value.d1Capacity.status) {
    case 'danger':
      return 'bg-rose-500'
    case 'warning':
      return 'bg-amber-500'
    default:
      return 'bg-slate-900'
  }
})

type CleanupAction = {
  key: string
  label: string
  title: string
  message: string
  scope: D1CleanupResult['scope']
  target: D1CleanupResult['target']
}

const cleanupActions: CleanupAction[] = [
  {
    key: 'temporary-mails',
    label: '清理临时邮件',
    title: '清理临时邮件',
    message: '将删除所有 ttl_hours > 0 的邮件记录，邮箱地址保留不动。',
    scope: 'mails',
    target: 'temporary',
  },
  {
    key: 'permanent-mails',
    label: '清理永久邮件',
    title: '清理永久邮件',
    message: '将删除所有 ttl_hours = 0 的邮件记录，邮箱地址保留不动。',
    scope: 'mails',
    target: 'permanent',
  },
  {
    key: 'temporary-addresses',
    label: '清理临时邮箱',
    title: '清理临时邮箱',
    message: '将删除所有 ttl_hours > 0 的邮箱地址，并一并删除这些地址下的邮件。',
    scope: 'addresses',
    target: 'temporary',
  },
  {
    key: 'permanent-addresses',
    label: '清理永久邮箱',
    title: '清理永久邮箱',
    message: '将删除所有 ttl_hours = 0 的邮箱地址，并一并删除这些地址下的邮件。',
    scope: 'addresses',
    target: 'permanent',
  },
]

const pendingCleanup = ref<CleanupAction | null>(null)
const cleanupSubmittingKey = ref('')
const cleanupMessage = ref('')
const cleanupError = ref('')
const autoCleanupEnabledInput = ref(false)
const autoCleanupSubmitting = ref(false)
const autoCleanupMessage = ref('')
const autoCleanupError = ref('')

watch(autoCleanupSettings, (value) => {
  autoCleanupEnabledInput.value = value.enabled
}, { immediate: true })

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function openCleanupConfirm(action: CleanupAction) {
  cleanupMessage.value = ''
  cleanupError.value = ''
  pendingCleanup.value = action
}

function cancelCleanup() {
  pendingCleanup.value = null
}

async function confirmCleanup() {
  if (!pendingCleanup.value) {
    return
  }

  cleanupSubmittingKey.value = pendingCleanup.value.key
  cleanupMessage.value = ''
  cleanupError.value = ''

  try {
    const response = await cleanupDashboardD1(authStore.token, pendingCleanup.value.scope, pendingCleanup.value.target)
    const result = response.data
    const targetText = pendingCleanup.value.target === 'temporary' ? '临时' : '永久'
    const scopeText = pendingCleanup.value.scope === 'mails' ? '邮件' : '邮箱'
    const addressText = result.deletedAddresses > 0 ? `，删除 ${result.deletedAddresses.toLocaleString('zh-CN')} 个邮箱` : ''

    cleanupMessage.value = `已清理${targetText}${scopeText}：删除 ${result.deletedMails.toLocaleString('zh-CN')} 封邮件${addressText}。当前 D1 占用 ${result.capacity.sizeLabel} / ${result.capacity.limitLabel}。`
    await mutate()
  } catch (error) {
    cleanupError.value = error instanceof Error ? error.message : '清理失败'
  } finally {
    cleanupSubmittingKey.value = ''
    pendingCleanup.value = null
  }
}

async function submitAutoCleanupSettings() {
  autoCleanupSubmitting.value = true
  autoCleanupMessage.value = ''
  autoCleanupError.value = ''

  try {
    const response = await updateD1AutoCleanupSettings(authStore.token, autoCleanupEnabledInput.value)
    autoCleanupMessage.value = response.data.enabled
      ? `已开启自动滚动清理：达到 ${response.data.triggerUsagePercent}% 后仅保留最近活跃的 ${response.data.keepTemporaryAddresses} 个临时邮箱。`
      : '已关闭自动滚动清理。'
    await mutateAutoCleanup()
  } catch (error) {
    autoCleanupError.value = error instanceof Error ? error.message : '保存自动清理设置失败'
  } finally {
    autoCleanupSubmitting.value = false
  }
}
</script>
