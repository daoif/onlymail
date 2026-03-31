import { MailsSdkError } from './errors.js'

// ── Types ─────────────────────────────────────────────────────

export interface AddressRecord {
  id: number
  name: string
  domain: string
  project: string
  ttl_hours: number
  created_at: string
  updated_at: string
}

export interface MailSummary {
  id: number
  address: string
  source: string
  subject: string
  created_at: string
}

export interface MailDetail extends MailSummary {
  raw: string
  text: string
  html: string
  message_id: string | null
}

export interface DomainRecord {
  id: number
  name: string
  root_name: string
  is_root: number
  routing_enabled: number
  cf_zone_id: string
  created_at: string
}

export interface DomainDetail extends DomainRecord {
  address_count: number
  address_count_by_project: Array<{ project: string; count: number }>
}

interface ApiEnvelope<T> {
  data: T
}

export interface Paginated<T> {
  items: T[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

// ── Client ────────────────────────────────────────────────────

export class MailsApiClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  private async request<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new MailsSdkError(payload?.error?.message ?? '请求失败', response.status, payload?.error?.details)
    }

    return payload as T
  }

  private async requestData<T>(path: string, init: RequestInit = {}) {
    const payload = await this.request<ApiEnvelope<T>>(path, init)
    return payload.data
  }

  // ── 邮箱操作 ──────────────────────────────────────────────

  createAddress(address: string, project: string, ttlHours?: number) {
    return this.requestData<{ status: 'created' | 'occupied' | 'available'; address: AddressRecord }>('/call/address', {
      method: 'POST',
      body: JSON.stringify({ address, project, ttl_hours: ttlHours }),
    })
  }

  getMailList(address: string, page = 1, size = 20) {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    return this.requestData<Paginated<MailSummary>>(`/call/mails/${encodeURIComponent(address)}?${params.toString()}`)
  }

  getMail(id: number) {
    return this.requestData<MailDetail>(`/call/mail/${id}`)
  }

  // ── 域名操作 ──────────────────────────────────────────────

  listDomains(type?: 'root' | 'sub', root?: string, limit?: number) {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (root) params.set('root', root)
    if (limit !== undefined) params.set('limit', String(limit))
    const qs = params.toString()
    return this.requestData<DomainRecord[]>(`/call/domains${qs ? `?${qs}` : ''}`)
  }

  getDomain(name: string) {
    return this.requestData<DomainDetail>(`/call/domains/${encodeURIComponent(name)}`)
  }

  createSubdomain(name: string, rootName?: string) {
    return this.requestData<DomainRecord>('/call/domains', {
      method: 'POST',
      body: JSON.stringify({ name, rootName: rootName || undefined }),
    })
  }
}
