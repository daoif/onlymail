<template>
  <div class="min-h-screen bg-white">
    <header class="border-b border-slate-200">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <BrandLockup subtitle="个人邮箱管理后台" />
        <div class="flex items-center gap-4">
          <nav class="flex items-center gap-1 rounded-full bg-slate-50 p-1 text-sm text-slate-600">
            <RouterLink v-for="item in items" :key="item.name" :to="item.to" class="rounded-full px-3 py-1.5 transition"
              :class="route.name === item.name ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'">
              {{ item.label }}
            </RouterLink>
          </nav>
          <button class="button-secondary" type="button" @click="logout">退出</button>
        </div>
      </div>
    </header>
    <div v-if="showUpdateBanner" class="border-b border-amber-200 bg-amber-50/70">
      <div class="mx-auto max-w-7xl px-6 py-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0 space-y-1">
            <p class="text-sm font-medium text-slate-900">
              有新版本可更新：{{ formatVersionText(versionState?.latestVersion) }}
            </p>
            <p class="text-sm text-slate-600">
              当前实例是 {{ formatVersionText(versionState?.currentVersion) }}。不自动更新的实例需要你手动跟进 release。
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <a :href="versionState?.updateGuideUrl || '#'" target="_blank" rel="noreferrer" class="button-secondary h-9 px-3">
              查看如何更新
            </a>
            <a :href="versionState?.repositoryUrl || '#'" target="_blank" rel="noreferrer" class="button-secondary h-9 px-3">
              查看项目仓库
            </a>
            <button class="button-secondary h-9 px-3" type="button" :disabled="bannerSubmitting" @click="dismissOnce">
              仅关闭本次更新通知
            </button>
            <button class="button-secondary h-9 px-3" type="button" :disabled="bannerSubmitting" @click="disableForever">
              永久关闭更新通知
            </button>
          </div>
        </div>
        <p v-if="bannerError" class="mt-2 text-sm text-rose-600">{{ bannerError }}</p>
      </div>
    </div>
    <main class="page-shell">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'

import { dismissVersionUpdateOnce, getVersionState, logout as logoutRequest, setVersionNotifications } from '../api/admin'
import { ApiError } from '../api/client'
import BrandLockup from './BrandLockup.vue'
import { useSWR } from '../composables/useSWR'
import { shouldShowUpdateBanner, formatVersionText } from '../lib/update-notice'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const bannerSubmitting = ref(false)
const bannerError = ref('')

const items = [
  { name: 'dashboard', label: '仪表盘', to: '/dashboard' },
  { name: 'addresses', label: '地址', to: '/addresses' },
  { name: 'mails', label: '邮件', to: '/mails' },
  { name: 'domains', label: '域名', to: '/domains' },
  { name: 'settings', label: '设置', to: '/settings' },
]

const { data: versionData, mutate: mutateVersion } = useSWR({
  key: 'settings-version',
  fetcher: () => getVersionState(authStore.token),
})

const versionState = computed(() => versionData.value?.data ?? null)
const showUpdateBanner = computed(() => shouldShowUpdateBanner(versionState.value))

async function dismissOnce() {
  if (!versionState.value?.latestVersion) return
  bannerSubmitting.value = true
  bannerError.value = ''
  try {
    await dismissVersionUpdateOnce(authStore.token, versionState.value.latestVersion)
    await mutateVersion()
  } catch (error) {
    bannerError.value = error instanceof ApiError ? error.message : '关闭本次更新通知失败'
  } finally {
    bannerSubmitting.value = false
  }
}

async function disableForever() {
  bannerSubmitting.value = true
  bannerError.value = ''
  try {
    await setVersionNotifications(authStore.token, true)
    await mutateVersion()
  } catch (error) {
    bannerError.value = error instanceof ApiError ? error.message : '永久关闭更新通知失败'
  } finally {
    bannerSubmitting.value = false
  }
}

async function logout() {
  const token = authStore.token
  if (token) {
    try {
      await logoutRequest(token)
    } catch {
      // 后端会话不存在时，本地也要能直接退出
    }
  }

  authStore.clearSession()
  router.push({ name: 'login' })
}
</script>
