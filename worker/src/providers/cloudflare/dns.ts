/**
 * Cloudflare DNS Provider 实现
 */

import type { DnsProvider, DnsRecord, ZoneInfo } from '../types'
import { CloudflareBase } from './base'

type ZoneResult = { id: string; name: string; status: string; name_servers: string[] }

export class CloudflareDnsProvider extends CloudflareBase implements DnsProvider {
  async resolveZoneId(zoneName: string, zoneId?: string) {
    if (zoneId) return zoneId

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
    const query = new URLSearchParams()
    if (params?.type) query.set('type', params.type)
    if (params?.name) query.set('name', params.name)
    const qs = query.toString() ? `?${query.toString()}` : ''
    return this.request<DnsRecord[]>(`/zones/${zoneId}/dns_records${qs}`)
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

