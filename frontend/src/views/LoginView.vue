<template>
  <div class="flex min-h-screen items-center justify-center bg-white px-6">
    <div v-if="checkingInit" class="w-full max-w-sm space-y-2 text-center">
      <BrandLockup centered size="lg" title-tag="h1" />
      <p class="page-subtitle">正在检查管理员初始化状态。</p>
    </div>

    <form v-else class="w-full max-w-sm space-y-5" @submit.prevent="submit">
      <div class="space-y-2">
        <BrandLockup centered size="lg" title-tag="h1" />
        <p class="page-subtitle">
          {{ initialized ? '输入管理员账号和密码进入后台。' : '首次访问先创建管理员账号，后续用它登录后台。' }}
        </p>
      </div>
      <div class="space-y-4">
        <label class="block space-y-2 text-sm text-slate-600">
          <span>用户名</span>
          <input v-model="username" class="input-base" type="text" autocomplete="username" />
        </label>
        <label class="block space-y-2 text-sm text-slate-600">
          <span>{{ initialized ? '密码' : '设置密码' }}</span>
          <input
            v-model="password"
            class="input-base"
            type="password"
            :autocomplete="initialized ? 'current-password' : 'new-password'"
          />
        </label>
        <label v-if="!initialized" class="block space-y-2 text-sm text-slate-600">
          <span>确认密码</span>
          <input v-model="confirmPassword" class="input-base" type="password" autocomplete="new-password" />
        </label>
      </div>
      <p v-if="infoMessage" class="text-sm text-slate-500">{{ infoMessage }}</p>
      <p v-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>
      <button class="button-primary w-full" type="submit" :disabled="submitting">
        {{ submitting ? (initialized ? '登录中…' : '创建中…') : initialized ? '登录' : '创建管理员' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getInitStatus, initAdmin, login } from '../api/admin'
import { ApiError } from '../api/client'
import BrandLockup from '../components/BrandLockup.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const initialized = ref(true)
const checkingInit = ref(true)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const infoMessage = ref('')
const errorMessage = ref('')
const submitting = ref(false)

async function loadInitStatus() {
  const response = await getInitStatus()
  initialized.value = response.data.initialized
}

async function submitLogin() {
  const response = await login(username.value, password.value)
  authStore.setSession(response.data.token, response.data.username)
  await router.push({ name: 'dashboard' })
}

async function submitInit() {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }

  await initAdmin(username.value, password.value)
  initialized.value = true
  password.value = ''
  confirmPassword.value = ''
  infoMessage.value = '管理员账号已创建，请登录。'
}

onMounted(async () => {
  errorMessage.value = ''

  try {
    await loadInitStatus()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '初始化状态加载失败'
  } finally {
    checkingInit.value = false
  }
})

async function submit() {
  infoMessage.value = ''
  errorMessage.value = ''
  submitting.value = true

  try {
    if (initialized.value) {
      await submitLogin()
      return
    }

    await submitInit()
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      await loadInitStatus()
      infoMessage.value = '管理员账号已创建，请直接登录。'
      password.value = ''
      confirmPassword.value = ''
    } else {
      errorMessage.value = error instanceof ApiError ? error.message : initialized.value ? '登录失败' : '初始化失败'
    }
  } finally {
    submitting.value = false
  }
}
</script>


