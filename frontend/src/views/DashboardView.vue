<template>
  <AppShell>
    <section class="space-y-6">
      <div class="space-y-1">
        <h1 class="page-title">仪表盘</h1>
        <p class="page-subtitle">查看当前地址、邮件和域名的整体状态。</p>
      </div>

      <SkeletonLoader v-if="isLoading" variant="cards" :count="4" />

      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="总地址数" :value="stats.totalAddresses" />
        <StatCard label="总邮件数" :value="stats.totalMails" />
        <StatCard label="已配置域名数" :value="stats.totalDomains" />
        <StatCard label="今日新邮件数" :value="stats.todayMailCount" />
      </div>

      <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
    </section>
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { getDashboard } from '../api/admin'
import AppShell from '../components/AppShell.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import StatCard from '../components/StatCard.vue'
import { useSWR } from '../composables/useSWR'
import { useAuthStore } from '../stores/auth'
import type { ApiEnvelope, DashboardStats } from '../types'

const authStore = useAuthStore()

const { data, error, isLoading } = useSWR<ApiEnvelope<DashboardStats>>({
  key: 'dashboard',
  fetcher: () => getDashboard(authStore.token),
})

const stats = computed(() => data.value?.data ?? {
  totalAddresses: 0,
  totalMails: 0,
  totalDomains: 0,
  todayMailCount: 0,
})
</script>
