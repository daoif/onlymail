/**
 * Cloudflare Workers Custom Domains + Pages Custom Domains Provider 实现
 */

import type { CustomDomainEntry, DomainBindingProvider, PagesDomainEntry } from '../types'
import { CloudflareBase } from './base'

type CfCustomDomain = {
  id: string
  hostname: string
  service: string
  environment: string
}

type CfPagesDomain = {
  id: string | null
  name: string
  status: string | null
  validation_data?: {
    method?: string | null
    status?: string | null
    error_message?: string | null
    txt_name?: string | null
    txt_value?: string | null
  } | null
  verification_data?: {
    status?: string | null
    error_message?: string | null
  } | null
  zone_tag?: string | null
}

type CfPagesProject = {
  subdomain: string
}

function mapPagesDomain(domain: CfPagesDomain): PagesDomainEntry {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status,
    validationData: domain.validation_data ? {
      method: domain.validation_data.method,
      status: domain.validation_data.status,
      errorMessage: domain.validation_data.error_message,
      txtName: domain.validation_data.txt_name,
      txtValue: domain.validation_data.txt_value,
    } : undefined,
    verificationData: domain.verification_data ? {
      status: domain.verification_data.status,
      errorMessage: domain.verification_data.error_message,
    } : undefined,
    zoneTag: domain.zone_tag,
  }
}

export class CloudflareDomainBindingProvider extends CloudflareBase implements DomainBindingProvider {
  // ── Workers Custom Domains ──────────────────────────────────

  async listWorkerDomains(accountId: string): Promise<CustomDomainEntry[]> {
    const result = await this.request<CfCustomDomain[]>(
      `/accounts/${accountId}/workers/domains`,
    )

    return result.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      service: d.service,
      environment: d.environment,
    }))
  }

  async addWorkerDomain(
    accountId: string,
    hostname: string,
    zoneId: string,
    service: string,
  ): Promise<CustomDomainEntry> {
    const result = await this.request<CfCustomDomain>(
      `/accounts/${accountId}/workers/domains`,
      {
        method: 'PUT',
        body: JSON.stringify({
          hostname,
          zone_id: zoneId,
          service,
          environment: 'production',
        }),
      },
    )

    return {
      id: result.id,
      hostname: result.hostname,
      service: result.service,
      environment: result.environment,
    }
  }

  async removeWorkerDomain(accountId: string, domainId: string): Promise<void> {
    await this.request(
      `/accounts/${accountId}/workers/domains/${domainId}`,
      { method: 'DELETE' },
    )
  }

  // ── Pages Custom Domains ────────────────────────────────────

  async listPagesDomains(accountId: string, projectName: string): Promise<PagesDomainEntry[]> {
    const result = await this.request<CfPagesDomain[]>(
      `/accounts/${accountId}/pages/projects/${projectName}/domains`,
    )

    return result.map(mapPagesDomain)
  }

  async getPagesProjectSubdomain(accountId: string, projectName: string): Promise<string> {
    const result = await this.request<CfPagesProject>(
      `/accounts/${accountId}/pages/projects/${projectName}`,
    )

    return result.subdomain
  }

  async addPagesDomain(accountId: string, projectName: string, domain: string): Promise<PagesDomainEntry> {
    const result = await this.request<CfPagesDomain>(
      `/accounts/${accountId}/pages/projects/${projectName}/domains`,
      {
        method: 'POST',
        body: JSON.stringify({ name: domain }),
      },
    )

    return mapPagesDomain(result)
  }

  async retryPagesDomainValidation(accountId: string, projectName: string, domain: string): Promise<PagesDomainEntry> {
    const result = await this.request<CfPagesDomain>(
      `/accounts/${accountId}/pages/projects/${projectName}/domains/${domain}`,
      {
        method: 'PATCH',
        body: JSON.stringify({}),
      },
    )

    return mapPagesDomain(result)
  }

  async removePagesDomain(accountId: string, projectName: string, domain: string): Promise<void> {
    await this.request(
      `/accounts/${accountId}/pages/projects/${projectName}/domains/${domain}`,
      { method: 'DELETE' },
    )
  }
}


