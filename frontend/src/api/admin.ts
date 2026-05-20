import type {
  AddressRecord,
  ApiEnvelope,
  D1CleanupResult,
  DashboardStats,
  DomainLifecycleSettings,
  DomainRecord,
  MailDetail,
  MailSummary,
  PaginationMeta,
  SettingsApiKeyState,
  VersionUpdateState,
} from '../types'

import { apiRequest } from './client'

type Paginated<T> = {
  items: T[]
  pagination: PaginationMeta
}

export type AddressCreateResult = {
  status: 'created' | 'occupied' | 'available'
  address: AddressRecord
}

type QueryValue = string | number | boolean | undefined
export type SubdomainType = 'permanent' | 'temporary'
export type SubdomainDnsMode = DomainLifecycleSettings['subdomainDnsMode']

function toSearchString(params?: URLSearchParams | Record<string, QueryValue>) {
  if (!params) return ''
  if (params instanceof URLSearchParams) {
    const value = params.toString()
    return value ? `?${value}` : ''
  }

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function getInitStatus() {
  return apiRequest<ApiEnvelope<{ initialized: boolean }>>('/api/init-status')
}

export function initAdmin(username: string, password: string) {
  return apiRequest<ApiEnvelope<{ username: string }>>('/api/init', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function login(username: string, password: string) {
  return apiRequest<ApiEnvelope<{ token: string; username: string }>>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout(token: string) {
  return apiRequest<{ message: string }>('/api/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  }, token)
}

export function getDashboard(token: string) {
  return apiRequest<ApiEnvelope<DashboardStats>>('/api/dashboard', {}, token)
}

export function cleanupDashboardD1(token: string, scope: 'mails' | 'addresses', target: 'temporary' | 'permanent') {
  return apiRequest<ApiEnvelope<D1CleanupResult>>(
    '/api/dashboard/cleanup',
    {
      method: 'POST',
      body: JSON.stringify({ scope, target }),
    },
    token,
  )
}

export function getAddresses(token: string, params: URLSearchParams) {
  return apiRequest<ApiEnvelope<Paginated<AddressRecord>>>(`/api/addresses?${params.toString()}`, {}, token)
}

export function createAddress(token: string, address: string, project: string, ttlHours?: number) {
  return apiRequest<ApiEnvelope<AddressCreateResult>>(
    '/api/address',
    {
      method: 'POST',
      body: JSON.stringify({ address, project, ttl_hours: ttlHours }),
    },
    token,
  )
}

export function deleteAdminAddress(token: string, address: string) {
  return apiRequest<{ message: string }>(`/api/address/${encodeURIComponent(address)}`, { method: 'DELETE' }, token)
}

export function getMails(token: string, params: URLSearchParams) {
  return apiRequest<ApiEnvelope<Paginated<MailSummary>>>(`/api/mails?${params.toString()}`, {}, token)
}

export function getMail(token: string, id: number) {
  return apiRequest<ApiEnvelope<MailDetail>>(`/api/mail/${id}`, {}, token)
}

export function deleteAdminMail(token: string, id: number) {
  return apiRequest<{ message: string }>(`/api/mail/${id}`, { method: 'DELETE' }, token)
}

export function getDomains(token: string, params?: URLSearchParams | Record<string, QueryValue>) {
  return apiRequest<ApiEnvelope<DomainRecord[]>>(`/api/domains${toSearchString(params)}`, {}, token)
}

export function bootstrapDomain(token: string, rootDomain: string) {
  return apiRequest<ApiEnvelope<DomainRecord>>(
    '/api/domains/bootstrap',
    {
      method: 'POST',
      body: JSON.stringify({ rootDomain }),
    },
    token,
  )
}

export function createSubdomain(token: string, name: string, subdomainType: SubdomainType = 'permanent') {
  return apiRequest<ApiEnvelope<DomainRecord>>(
    '/api/domains',
    {
      method: 'POST',
      body: JSON.stringify({ name, subdomainType }),
    },
    token,
  )
}

export function deleteDomain(token: string, name: string) {
  return apiRequest<{ message: string }>(`/api/domains/${encodeURIComponent(name)}`, { method: 'DELETE' }, token)
}

export function batchDeleteDomains(token: string, names: string[]) {
  return apiRequest<ApiEnvelope<{ deleted: string[]; skippedRoots: string[]; skippedMissing: string[] }>>(
    '/api/domains/batch-delete',
    {
      method: 'POST',
      body: JSON.stringify({ names }),
    },
    token,
  )
}

export function getApiKeyState(token: string) {
  return apiRequest<ApiEnvelope<SettingsApiKeyState>>('/api/settings/api-key', {}, token)
}

export function getVersionState(token: string) {
  return apiRequest<ApiEnvelope<VersionUpdateState>>('/api/settings/version', {}, token)
}

export function checkVersionState(token: string) {
  return apiRequest<ApiEnvelope<VersionUpdateState>>(
    '/api/settings/version/check',
    { method: 'POST', body: JSON.stringify({}) },
    token,
  )
}

export function dismissVersionUpdateOnce(token: string, version: string) {
  return apiRequest<ApiEnvelope<VersionUpdateState>>(
    '/api/settings/version/dismiss-once',
    {
      method: 'POST',
      body: JSON.stringify({ version }),
    },
    token,
  )
}

export function setVersionNotifications(token: string, disabled: boolean) {
  return apiRequest<ApiEnvelope<VersionUpdateState>>(
    '/api/settings/version/notifications',
    {
      method: 'POST',
      body: JSON.stringify({ disabled }),
    },
    token,
  )
}

export function getDomainLifecycleSettings(token: string) {
  return apiRequest<ApiEnvelope<DomainLifecycleSettings>>('/api/settings/domain-lifecycle', {}, token)
}

export function updateDomainLifecycleSettings(token: string, subdomainRotationLimit: number, subdomainDnsMode: SubdomainDnsMode) {
  return apiRequest<ApiEnvelope<DomainLifecycleSettings>>(
    '/api/settings/domain-lifecycle',
    {
      method: 'PUT',
      body: JSON.stringify({ subdomainRotationLimit, subdomainDnsMode }),
    },
    token,
  )
}

export function rotateApiKey(token: string) {
  return apiRequest<ApiEnvelope<{ apiKey: string; preview: string; rotatedAt: string }>>(
    '/api/settings/api-key/rotate',
    { method: 'POST', body: JSON.stringify({}) },
    token,
  )
}

export function changePassword(token: string, oldPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>(
    '/api/settings/change-password',
    {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    },
    token,
  )
}

// ── 自定义域名绑定 ────────────────────────────────────────────

export interface CustomDomainEntry {
  id: string
  hostname: string
  service?: string
  environment?: string
}

export function getCustomDomains(token: string) {
  return apiRequest<ApiEnvelope<CustomDomainEntry[]>>('/api/settings/custom-domains', {}, token)
}

export function addCustomDomain(token: string, hostname: string) {
  return apiRequest<ApiEnvelope<CustomDomainEntry>>(
    '/api/settings/custom-domains',
    {
      method: 'POST',
      body: JSON.stringify({ hostname }),
    },
    token,
  )
}

export function removeCustomDomain(token: string, id: string) {
  return apiRequest<{ message: string }>(`/api/settings/custom-domains/${id}`, { method: 'DELETE' }, token)
}

// ── Pages 自定义域名 ──────────────────────────────────────────

export interface PagesDomainEntry {
  id: string | null
  name: string
  status: string | null
  validationData?: {
    method?: string | null
    status?: string | null
    errorMessage?: string | null
    txtName?: string | null
    txtValue?: string | null
  }
  verificationData?: {
    status?: string | null
    errorMessage?: string | null
  }
  zoneTag?: string | null
}

export function getPagesDomains(token: string) {
  return apiRequest<ApiEnvelope<PagesDomainEntry[]>>('/api/settings/pages-domains', {}, token)
}

export function addPagesDomain(token: string, domain: string) {
  return apiRequest<ApiEnvelope<PagesDomainEntry>>(
    '/api/settings/pages-domains',
    {
      method: 'POST',
      body: JSON.stringify({ domain }),
    },
    token,
  )
}

export function removePagesDomain(token: string, domain: string) {
  return apiRequest<{ message: string }>(`/api/settings/pages-domains/${encodeURIComponent(domain)}`, { method: 'DELETE' }, token)
}



