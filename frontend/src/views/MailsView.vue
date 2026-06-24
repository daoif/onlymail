<template>
  <AppShell>
    <section class="space-y-6">
      <div class="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <h1 class="page-title">邮件</h1>
          <p class="page-subtitle">按地址筛选邮件，左侧列表，右侧查看详情。</p>
        </div>
        <button class="button-secondary h-10 px-4" type="button" :disabled="listLoading" @click="refreshList">
          {{ listLoading ? '刷新中…' : '刷新' }}
        </button>
      </div>

      <div class="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div class="space-y-4">
          <input v-model="addressFilter" class="input-base" type="text" placeholder="按地址筛选" @change="refreshList" />
          <p v-if="listErrorMessage" class="text-sm text-rose-600">{{ listErrorMessage }}</p>

          <SkeletonLoader v-if="listLoading" variant="text" :rows="8" />

          <div v-else class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <button
              v-for="mail in mails"
              :key="mail.id"
              type="button"
              class="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0"
              :class="selectedMailId === mail.id ? 'bg-slate-50' : 'hover:bg-slate-50/70'"
              @click="selectMail(mail.id)"
            >
              <p class="truncate text-sm font-medium text-slate-900">{{ mail.subject || '(无主题)' }}</p>
              <p class="mt-1 truncate text-sm text-slate-500">{{ mail.source }}</p>
              <p class="mt-1 text-xs text-slate-400">{{ formatDate(mail.created_at) }}</p>
            </button>
            <div v-if="mails.length === 0" class="px-4 py-12 text-center text-sm text-slate-500">暂无邮件</div>
          </div>

          <AppPagination v-if="!listLoading" :pagination="pagination" @update:page="setPage" />
        </div>

        <div class="min-h-[520px] rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div v-if="selectedMail" class="space-y-5">
            <div class="border-b border-slate-200 pb-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-xl font-semibold text-slate-900">{{ selectedMail.subject || '(无主题)' }}</h2>
                  <p class="mt-1 text-sm text-slate-500">{{ selectedMail.source }} · {{ formatDate(selectedMail.created_at) }}</p>
                </div>
                <button class="button-danger" type="button" @click="openDelete(selectedMail.id)">删除</button>
              </div>
            </div>
            <div v-if="safeHtml" class="prose prose-slate max-w-none" v-html="safeHtml"></div>
            <pre v-else class="whitespace-pre-wrap text-sm leading-6 text-slate-700">{{ selectedMail.text || selectedMail.raw }}</pre>
          </div>
          <div v-else class="flex h-full items-center justify-center text-sm text-slate-500">请选择一封邮件查看内容。</div>
        </div>
      </div>
    </section>

    <ConfirmModal
      :open="pendingDeleteId !== null"
      title="删除邮件"
      message="删除后这封邮件不会再保留。"
      confirm-label="确认删除"
      destructive
      @cancel="pendingDeleteId = null"
      @confirm="confirmDelete"
    />
  </AppShell>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '../api/client'
import { deleteAdminMail, getMail, getMails } from '../api/admin'
import AppShell from '../components/AppShell.vue'
import AppPagination from '../components/AppPagination.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import type { MailDetail, MailSummary, PaginationMeta } from '../types'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const addressFilter = ref(String(route.query.address ?? ''))
const mails = ref<MailSummary[]>([])
const pagination = ref<PaginationMeta>({ page: 1, size: 50, total: 0, totalPages: 1 })
const currentPage = ref(1)
const selectedMailId = ref<number | null>(null)
const selectedMail = ref<MailDetail | null>(null)
const pendingDeleteId = ref<number | null>(null)
const listLoading = ref(true)
const listErrorMessage = ref('')

const safeHtml = computed(() => (selectedMail.value?.html ? DOMPurify.sanitize(selectedMail.value.html) : ''))

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN')
}

async function refreshList() {
  listLoading.value = true
  listErrorMessage.value = ''
  try {
    const params = new URLSearchParams({ page: String(currentPage.value), size: String(pagination.value.size) })
    const normalizedAddress = addressFilter.value.trim()
    if (normalizedAddress) params.set('address', normalizedAddress)
    const response = await getMails(authStore.token, params)
    mails.value = response.data.items
    pagination.value = response.data.pagination

    if (pagination.value.page > pagination.value.totalPages) {
      currentPage.value = pagination.value.totalPages
      await refreshList()
      return
    }

    if (selectedMailId.value && mails.value.some((item) => item.id === selectedMailId.value)) {
      return
    }

    if (mails.value.length > 0) {
      await selectMail(mails.value[0].id)
    } else {
      selectedMailId.value = null
      selectedMail.value = null
    }
  } catch (error) {
    listErrorMessage.value = error instanceof ApiError ? error.message : '加载邮件失败'
  } finally {
    listLoading.value = false
  }
}

async function selectMail(id: number) {
  selectedMailId.value = id
  const response = await getMail(authStore.token, id)
  selectedMail.value = response.data
}

function openDelete(id: number) {
  pendingDeleteId.value = id
}

async function confirmDelete() {
  if (pendingDeleteId.value === null) return
  await deleteAdminMail(authStore.token, pendingDeleteId.value)
  pendingDeleteId.value = null
  if (mails.value.length === 1 && currentPage.value > 1) {
    currentPage.value -= 1
  }
  await refreshList()
}

function setPage(page: number) {
  currentPage.value = page
  refreshList()
}

watch(addressFilter, (value) => {
  const normalizedAddress = value.trim()
  currentPage.value = 1
  router.replace({ name: 'mails', query: normalizedAddress ? { address: normalizedAddress } : {} })
})

onMounted(refreshList)
</script>
