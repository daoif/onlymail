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
    <main class="page-shell">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute, RouterLink } from 'vue-router'

import BrandLockup from './BrandLockup.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const items = [
  { name: 'dashboard', label: '仪表盘', to: '/dashboard' },
  { name: 'addresses', label: '地址', to: '/addresses' },
  { name: 'mails', label: '邮件', to: '/mails' },
  { name: 'domains', label: '域名', to: '/domains' },
  { name: 'settings', label: '设置', to: '/settings' },
]

function logout() {
  authStore.clearSession()
  router.push({ name: 'login' })
}
</script>
