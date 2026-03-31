<template>
  <AppShell>
    <section class="space-y-6">
      <div class="space-y-1">
        <h1 class="page-title">设置</h1>
        <p class="page-subtitle">查看管理员账号、修改密码，管理 API Key 和自定义域名。</p>
      </div>

      <SkeletonLoader v-if="isLoading" variant="cards" :count="2" grid-class="lg:grid-cols-[minmax(0,1fr)_320px]" />

      <template v-else>
        <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div class="border-b border-slate-200 pb-4">
              <p class="text-sm text-slate-500">管理员账号</p>
              <p class="mt-2 text-base font-medium text-slate-900">{{ settings.adminUser || '未配置' }}</p>
            </div>
            <div class="space-y-2">
              <p class="text-sm text-slate-500">当前 API Key 预览</p>
              <p class="text-base font-medium text-slate-900">{{ settings.preview || '尚未生成' }}</p>
              <p class="text-sm text-slate-500">最近轮换时间：{{ settings.rotatedAt ? formatDate(settings.rotatedAt) : '暂无' }}</p>
            </div>
            <div v-if="newKey" class="rounded-2xl bg-slate-50 p-4">
              <p class="text-sm text-slate-500">新 API Key（只显示这一次）</p>
              <code class="mt-2 block break-all text-sm text-slate-900">{{ newKey }}</code>
              <button class="button-secondary mt-4" type="button" @click="copyNewKey">复制新 Key</button>
            </div>
          </div>

          <div class="space-y-4">
            <div class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div>
                <h2 class="text-lg font-semibold text-slate-900">轮换 API Key</h2>
                <p class="mt-1 text-sm text-slate-500">轮换后旧 key 会立刻失效。</p>
              </div>
              <button class="button-primary w-full" type="button" @click="confirmOpen = true">生成新 Key</button>
              <p v-if="apiMessage" class="text-sm text-slate-500">{{ apiMessage }}</p>
              <p v-if="apiErrorMessage" class="text-sm text-rose-600">{{ apiErrorMessage }}</p>
            </div>

            <form class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70" @submit.prevent="submitPasswordChange">
              <div>
                <h2 class="text-lg font-semibold text-slate-900">修改密码</h2>
                <p class="mt-1 text-sm text-slate-500">保存后，下次登录需要使用新密码。</p>
              </div>
              <label class="block space-y-2 text-sm text-slate-600">
                <span>旧密码</span>
                <input v-model="oldPassword" class="input-base" type="password" autocomplete="current-password" />
              </label>
              <label class="block space-y-2 text-sm text-slate-600">
                <span>新密码</span>
                <input v-model="newPassword" class="input-base" type="password" autocomplete="new-password" />
              </label>
              <label class="block space-y-2 text-sm text-slate-600">
                <span>确认新密码</span>
                <input v-model="confirmNewPassword" class="input-base" type="password" autocomplete="new-password" />
              </label>
              <button class="button-primary w-full" type="submit" :disabled="passwordSubmitting">
                {{ passwordSubmitting ? '保存中…' : '更新密码' }}
              </button>
              <p v-if="passwordMessage" class="text-sm text-slate-500">{{ passwordMessage }}</p>
              <p v-if="passwordErrorMessage" class="text-sm text-rose-600">{{ passwordErrorMessage }}</p>
            </form>
          </div>
        </div>

        <!-- Worker API 自定义域名 -->
        <div class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Worker API 域名</h2>
            <p class="mt-1 text-sm text-slate-500">为后端 API 绑定自定义域名（如 mails-api.你的域名 → Worker）。系统会按域名自动解析 Zone，并按当前 Cloudflare 账号完成绑定。</p>
          </div>

          <div v-if="workerDomainsLoading" class="py-4 text-center text-sm text-slate-500">加载中…</div>
          <template v-else>
            <div v-if="workerDomains.length > 0" class="overflow-hidden rounded-xl ring-1 ring-slate-200/70">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th class="px-4 py-3 font-medium">域名</th>
                    <th class="px-4 py-3 font-medium">Worker</th>
                    <th class="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="d in workerDomains" :key="d.id">
                    <td class="px-4 py-3 text-slate-900">{{ d.hostname }}</td>
                    <td class="px-4 py-3 text-slate-600">{{ d.service }}</td>
                    <td class="px-4 py-3 text-right">
                      <button class="button-danger" type="button" @click="pendingRemoveWorkerDomain = d">移除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="py-2 text-sm text-slate-500">暂无绑定。</p>
          </template>

          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="submitAddWorkerDomain">
            <input v-model="newWorkerHostname" class="input-base flex-1" type="text" placeholder="mails-api.你的域名" />
            <button class="button-primary whitespace-nowrap sm:w-28" type="submit">绑定</button>
          </form>
          <p v-if="workerDomainMsg" class="text-sm text-slate-500">{{ workerDomainMsg }}</p>
          <p v-if="workerDomainErr" class="text-sm text-rose-600">{{ workerDomainErr }}</p>
        </div>

        <!-- Pages 前端自定义域名 -->
        <div class="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">前端 Pages 域名</h2>
            <p class="mt-1 text-sm text-slate-500">为前端面板绑定自定义域名（如 mails.你的域名 → Pages）。系统会按域名自动解析 Zone、把 CNAME 指到 Pages 项目的真实 subdomain，并立即重试验证。HTTP 验证先变成已生效后，证书验证再等 5 到 10 分钟都算正常。</p>
          </div>

          <div v-if="pagesDomainsLoading" class="py-4 text-center text-sm text-slate-500">加载中…</div>
          <template v-else>
            <div v-if="pagesDomains.length > 0" class="overflow-hidden rounded-xl ring-1 ring-slate-200/70">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th class="px-4 py-3 font-medium">域名</th>
                    <th class="px-4 py-3 font-medium">状态</th>
                    <th class="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="d in pagesDomains" :key="d.name">
                    <td class="px-4 py-3 text-slate-900">{{ d.name }}</td>
                    <td class="px-4 py-3">
                      <p class="text-slate-900">{{ formatPagesDomainStatus(d.status) }}</p>
                      <p v-if="getPagesDomainHint(d)" class="mt-1 text-xs text-slate-500">{{ getPagesDomainHint(d) }}</p>
                      <p v-if="getPagesDomainNotice(d)" class="mt-1 text-xs text-amber-700">{{ getPagesDomainNotice(d) }}</p>
                      <p v-if="getPagesDomainError(d)" class="mt-1 text-xs text-rose-600">{{ getPagesDomainError(d) }}</p>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button class="button-danger" type="button" @click="pendingRemovePagesDomain = d.name">移除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="py-2 text-sm text-slate-500">暂无绑定。</p>
          </template>

          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="submitAddPagesDomain">
            <input v-model="newPagesDomain" class="input-base flex-1" type="text" placeholder="mails.你的域名" />
            <button class="button-primary whitespace-nowrap sm:w-28" type="submit">绑定</button>
          </form>
          <p class="text-sm text-slate-500">如果这个域名之前已经有旧的 CNAME，系统会自动改到当前 Pages 项目的真实 subdomain。</p>
          <p v-if="pagesDomainMsg" class="text-sm text-slate-500">{{ pagesDomainMsg }}</p>
          <p v-if="pagesDomainErr" class="text-sm text-rose-600">{{ pagesDomainErr }}</p>
        </div>
      </template>
    </section>

    <ConfirmModal
      :open="confirmOpen"
      title="轮换 API Key"
      message="继续后旧 key 会立刻失效，只会返回一次新 key 明文。"
      confirm-label="确认轮换"
      @cancel="confirmOpen = false"
      @confirm="rotate"
    />
    <ConfirmModal
      :open="Boolean(pendingRemoveWorkerDomain)"
      title="移除 Worker 域名"
      :message="`移除 ${pendingRemoveWorkerDomain?.hostname ?? ''} 后将不再指向 Worker。`"
      confirm-label="确认移除"
      destructive
      @cancel="pendingRemoveWorkerDomain = null"
      @confirm="confirmRemoveWorkerDomain"
    />
    <ConfirmModal
      :open="Boolean(pendingRemovePagesDomain)"
      title="移除 Pages 域名"
      :message="`移除 ${pendingRemovePagesDomain ?? ''} 后将不再指向前端。`"
      confirm-label="确认移除"
      destructive
      @cancel="pendingRemovePagesDomain = ''"
      @confirm="confirmRemovePagesDomain"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  addCustomDomain,
  addPagesDomain,
  changePassword,
  getApiKeyState,
  getCustomDomains,
  getPagesDomains,
  removeCustomDomain,
  removePagesDomain,
  rotateApiKey,
} from '../api/admin'
import type { CustomDomainEntry, PagesDomainEntry } from '../api/admin'
import { ApiError } from '../api/client'
import AppShell from '../components/AppShell.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import type { ApiEnvelope, SettingsApiKeyState } from '../types'
import { useSWR } from '../composables/useSWR'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const confirmOpen = ref(false)
const newKey = ref('')
const apiMessage = ref('')
const apiErrorMessage = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const passwordMessage = ref('')
const passwordErrorMessage = ref('')
const passwordSubmitting = ref(false)

// Worker 域名
const workerDomains = ref<CustomDomainEntry[]>([])
const workerDomainsLoading = ref(true)
const newWorkerHostname = ref('')
const workerDomainMsg = ref('')
const workerDomainErr = ref('')
const pendingRemoveWorkerDomain = ref<CustomDomainEntry | null>(null)

// Pages 域名
const pagesDomains = ref<PagesDomainEntry[]>([])
const pagesDomainsLoading = ref(true)
const newPagesDomain = ref('')

const pagesDomainMsg = ref('')
const pagesDomainErr = ref('')
const pendingRemovePagesDomain = ref('')

const { data, error, isLoading, mutate } = useSWR<ApiEnvelope<SettingsApiKeyState>>({
  key: 'settings-api-key',
  fetcher: () => getApiKeyState(authStore.token),
})

const settings = computed(() => data.value?.data ?? {
  configured: false,
  preview: null,
  rotatedAt: null,
  adminUser: '',
})

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

function formatPagesDomainStatus(status?: string | null) {
  switch (status) {
    case 'active':
      return '已生效'
    case 'pending':
      return '等待验证'
    case 'initializing':
      return '初始化中'
    case 'deactivated':
      return '已停用'
    case 'blocked':
      return '被拦截'
    case 'error':
      return '出错'
    default:
      return status || '—'
  }
}

function getPagesDomainHint(domain: PagesDomainEntry) {
  const parts: string[] = []

  if (domain.validationData?.status) {
    const method = domain.validationData.method ? `（${domain.validationData.method.toUpperCase()}）` : ''
    parts.push(`域名验证${method}：${formatPagesDomainStatus(domain.validationData.status)}`)
  }

  if (domain.verificationData?.status) {
    parts.push(`证书验证：${formatPagesDomainStatus(domain.verificationData.status)}`)
  }

  return parts.join('；')
}

function getPagesDomainNotice(domain: PagesDomainEntry) {
  if (domain.validationData?.status === 'active' && domain.verificationData?.status === 'pending') {
    return 'DNS 通常已经对上了，证书验证再等 5 到 10 分钟都算正常；这段时间先不要重复删建。'
  }

  return ''
}

function getPagesDomainError(domain: PagesDomainEntry) {
  const message = domain.validationData?.errorMessage || domain.verificationData?.errorMessage || ''
  if (message === 'CNAME record not set' && domain.validationData?.status === 'active') {
    return ''
  }

  return message
}

// ── API Key ───────────────────────────────────────────────────

async function rotate() {
  confirmOpen.value = false
  apiErrorMessage.value = ''
  apiMessage.value = ''
  try {
    const response = await rotateApiKey(authStore.token)
    newKey.value = response.data.apiKey
    apiMessage.value = '新 API Key 已生成。'
    await mutate()
  } catch (err) {
    apiErrorMessage.value = err instanceof ApiError ? err.message : '轮换 API Key 失败'
  }
}

async function copyNewKey() {
  if (!newKey.value) return
  await navigator.clipboard.writeText(newKey.value)
  apiMessage.value = '新 API Key 已复制到剪贴板。'
}

// ── 修改密码 ──────────────────────────────────────────────────

async function submitPasswordChange() {
  passwordMessage.value = ''
  passwordErrorMessage.value = ''
  if (newPassword.value !== confirmNewPassword.value) {
    passwordErrorMessage.value = '两次输入的新密码不一致'
    return
  }
  passwordSubmitting.value = true
  try {
    await changePassword(authStore.token, oldPassword.value, newPassword.value)
    oldPassword.value = ''
    newPassword.value = ''
    confirmNewPassword.value = ''
    passwordMessage.value = '密码已更新。'
  } catch (err) {
    passwordErrorMessage.value = err instanceof ApiError ? err.message : '修改密码失败'
  } finally {
    passwordSubmitting.value = false
  }
}

// ── Worker 自定义域名 ─────────────────────────────────────────

async function loadWorkerDomains() {
  workerDomainsLoading.value = true
  try {
    const response = await getCustomDomains(authStore.token)
    workerDomains.value = response.data
  } catch {
    workerDomainErr.value = '加载 Worker 域名失败'
  } finally {
    workerDomainsLoading.value = false
  }
}

async function submitAddWorkerDomain() {
  workerDomainMsg.value = ''
  workerDomainErr.value = ''
  if (!newWorkerHostname.value.trim()) { workerDomainErr.value = '请输入域名'; return }
  try {
    const r = await addCustomDomain(authStore.token, newWorkerHostname.value.trim())
    workerDomainMsg.value = `域名 ${r.data.hostname} 已绑定。`
    newWorkerHostname.value = ''
    await loadWorkerDomains()
  } catch (err) {
    workerDomainErr.value = err instanceof ApiError ? err.message : '绑定域名失败'
  }
}

async function confirmRemoveWorkerDomain() {
  if (!pendingRemoveWorkerDomain.value) return
  try {
    await removeCustomDomain(authStore.token, pendingRemoveWorkerDomain.value.id)
    workerDomainMsg.value = `域名 ${pendingRemoveWorkerDomain.value.hostname} 已移除。`
    pendingRemoveWorkerDomain.value = null
    await loadWorkerDomains()
  } catch (err) {
    workerDomainErr.value = err instanceof ApiError ? err.message : '移除域名失败'
    pendingRemoveWorkerDomain.value = null
  }
}

// ── Pages 自定义域名 ──────────────────────────────────────────

async function loadPagesDomains() {
  pagesDomainsLoading.value = true
  try {
    const response = await getPagesDomains(authStore.token)
    pagesDomains.value = response.data
  } catch {
    // Pages 域名接口失败时不阻塞设置页其他区域
    pagesDomains.value = []
  } finally {
    pagesDomainsLoading.value = false
  }
}

async function submitAddPagesDomain() {
  pagesDomainMsg.value = ''
  pagesDomainErr.value = ''
  if (!newPagesDomain.value.trim()) { pagesDomainErr.value = '请输入域名'; return }
  try {
    const r = await addPagesDomain(authStore.token, newPagesDomain.value.trim())
    pagesDomainMsg.value = `Pages 域名 ${r.data.name} 已提交，系统已对齐 CNAME 并触发重试验证。HTTP 先通过后，证书再等 5 到 10 分钟都算正常。`
    newPagesDomain.value = ''
    await loadPagesDomains()
  } catch (err) {
    pagesDomainErr.value = err instanceof ApiError ? err.message : '绑定 Pages 域名失败'
  }
}

async function confirmRemovePagesDomain() {
  if (!pendingRemovePagesDomain.value) return
  try {
    await removePagesDomain(authStore.token, pendingRemovePagesDomain.value)
    pagesDomainMsg.value = `Pages 域名 ${pendingRemovePagesDomain.value} 已移除。`
    pendingRemovePagesDomain.value = ''
    await loadPagesDomains()
  } catch (err) {
    pagesDomainErr.value = err instanceof ApiError ? err.message : '移除 Pages 域名失败'
    pendingRemovePagesDomain.value = ''
  }
}

onMounted(() => {
  loadWorkerDomains()
  loadPagesDomains()
})
</script>



