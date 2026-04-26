/**
 * Cloudflare DNS Provider 实现
 */

import type { DnsProvider, DnsRecord, ZoneInfo } from '../types'
import { CloudflareBase } from './base'

type ZoneResult = {
  id: string
  name: string
  status: string
  name_servers: string[]
  created_on?: string
  plan?: {
    id?: string
    legacy_id?: string
    name?: string
  }
}

const DNS_RECORDS_PER_PAGE = 100
const FREE_ZONE_LEGACY_DNS_LIMIT_CUTOFF_MS = Date.parse('2024-09-01T00:00:00.000Z')

export function inferCloudflareDnsRecordLimit(zone: Pick<ZoneResult, 'created_on' | 'plan'>) {
  const planText = [
    zone.plan?.legacy_id,
    zone.plan?.id,
    zone.plan?.name,
  ].filter(Boolean).join(' ').toLowerCase()

  if (planText.includes('enterprise') || planText.includes('business') || planText.includes('pro')) {
    return 3500
  }

  const createdAt = zone.created_on ? Date.parse(zone.created_on) : Number.NaN
  if (Number.isFinite(createdAt) && createdAt < FREE_ZONE_LEGACY_DNS_LIMIT_CUTOFF_MS) {
    return 1000
  }

  return 200
}

export class CloudflareDnsProvider extends CloudflareBase implements DnsProvider {
  async resolveZoneId(zoneName: string) {
    const authMode = this.auth.token ? 'token' : 'global'
    const normalized = zoneName.trim().toLowerCase().replace(/\.+$/, '')
    const labels = normalized.split('.').filter(Boolean)

    for (let index = 0; index < labels.length; index += 1) {
      const candidate = labels.slice(index).join('.')
      const path = `/zones?name=${encodeURIComponent(candidate)}&status=active&per_page=1`
      const result = await this.request<ZoneResult[]>(path, undefined, authMode)
      const zone = result[0]
      if (zone) {
        return zone.id
      }
    }

    throw new Error(`找不到域名 ${zoneName} 对应的 Cloudflare Zone`)
  }

  async createZone(zoneName: string, accountId: string): Promise<ZoneInfo> {
    const result = await this.request<ZoneResult>('/zones', {
      method: 'POST',
      body: JSON.stringify({
        name: zoneName,
        account: { id: accountId },
        type: 'full',
      }),
    })

    return {
      id: result.id,
      name: result.name,
      status: result.status,
      nameServers: result.name_servers ?? [],
    }
  }

  async getZoneStatus(zoneId: string): Promise<ZoneInfo> {
    const result = await this.request<ZoneResult>(`/zones/${zoneId}`)
    return {
      id: result.id,
      name: result.name,
      status: result.status,
      nameServers: result.name_servers ?? [],
    }
  }

  async listDnsRecords(zoneId: string, params?: { type?: string; name?: string }): Promise<DnsRecord[]> {
    return (await this.listDnsRecordPages(zoneId, params)).records
  }

  async getDnsRecordInventory(zoneId: string) {
    const [zone, dnsRecords] = await Promise.all([
      this.request<ZoneResult>(`/zones/${zoneId}`),
      this.listDnsRecordPages(zoneId),
    ])
    const limit = inferCloudflareDnsRecordLimit(zone)
    const totalCount = dnsRecords.totalCount

    return {
      records: dnsRecords.records,
      totalCount,
      limit,
      remaining: Math.max(0, limit - totalCount),
    }
  }

  private async listDnsRecordPages(zoneId: string, params?: { type?: string; name?: string }) {
    const query = new URLSearchParams()
    if (params?.type) query.set('type', params.type)
    if (params?.name) query.set('name', params.name)
    query.set('per_page', String(DNS_RECORDS_PER_PAGE))
    query.set('page', '1')

    const firstEnvelope = await this.requestEnvelope<DnsRecord[]>(
      `/zones/${zoneId}/dns_records?${query.toString()}`,
    )
    const records = [...firstEnvelope.result]
    const totalPages = firstEnvelope.result_info?.total_pages ?? 1

    for (let page = 2; page <= totalPages; page += 1) {
      query.set('page', String(page))
      const envelope = await this.requestEnvelope<DnsRecord[]>(
        `/zones/${zoneId}/dns_records?${query.toString()}`,
      )
      records.push(...envelope.result)
    }

    return {
      records,
      totalCount: firstEnvelope.result_info?.total_count ?? records.length,
    }
  }

  async createDnsRecord(zoneId: string, record: Record<string, unknown>) {
    return this.request<DnsRecord>(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(record),
    })
  }

  async updateDnsRecord(zoneId: string, recordId: string, record: Record<string, unknown>) {
    return this.request<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(record),
    })
  }

  async deleteDnsRecord(zoneId: string, recordId: string) {
    return this.request<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    })
  }
}

