/**
 * 平台抽象层 — Provider 接口定义
 *
 * 所有平台特定操作（DNS、Email Routing 等）必须通过这些接口调用。
 * 当前唯一实现：providers/cloudflare/
 */

// ── DNS Provider ──────────────────────────────────────────────

export interface DnsRecord {
  id: string
  type: string
  name: string
  content: string
  priority?: number
}

export interface ZoneInfo {
  id: string
  name: string
  status: string
  nameServers: string[]
}

export interface DnsProvider {
  resolveZoneId(zoneName: string, zoneId?: string): Promise<string>
  createZone(zoneName: string, accountId: string): Promise<ZoneInfo>
  getZoneStatus(zoneId: string): Promise<ZoneInfo>
  listDnsRecords(zoneId: string, params?: { type?: string; name?: string }): Promise<DnsRecord[]>
  createDnsRecord(zoneId: string, record: Record<string, unknown>): Promise<DnsRecord>
  updateDnsRecord(zoneId: string, recordId: string, record: Record<string, unknown>): Promise<DnsRecord>
  deleteDnsRecord(zoneId: string, recordId: string): Promise<DnsRecord>
}

// ── Email Provider ────────────────────────────────────────────

export interface EmailRoutingSettings {
  enabled: boolean
  status?: string
  name: string
}

export interface EmailRule {
  id: string
  name?: string
}

export interface EmailProvider {
  getEmailRoutingSettings(zoneId: string): Promise<EmailRoutingSettings>
  enableEmailRouting(zoneId: string): Promise<EmailRoutingSettings>
  updateCatchAll(zoneId: string, workerName: string): Promise<EmailRule>
  createEmailRule(zoneId: string, payload: Record<string, unknown>): Promise<EmailRule>
  deleteEmailRule(zoneId: string, ruleId: string): Promise<EmailRule>
}

// ── Domain Binding Provider ───────────────────────────────────

export interface CustomDomainEntry {
  id: string
  hostname: string
  service?: string
  environment?: string
}

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

export interface DomainBindingProvider {
  listWorkerDomains(accountId: string): Promise<CustomDomainEntry[]>
  addWorkerDomain(accountId: string, hostname: string, zoneId: string, service: string): Promise<CustomDomainEntry>
  removeWorkerDomain(accountId: string, domainId: string): Promise<void>
  listPagesDomains(accountId: string, projectName: string): Promise<PagesDomainEntry[]>
  getPagesProjectSubdomain(accountId: string, projectName: string): Promise<string>
  addPagesDomain(accountId: string, projectName: string, domain: string): Promise<PagesDomainEntry>
  retryPagesDomainValidation(accountId: string, projectName: string, domain: string): Promise<PagesDomainEntry>
  removePagesDomain(accountId: string, projectName: string, domain: string): Promise<void>
}

// ── 聚合 Providers ────────────────────────────────────────────

export interface Providers {
  dns: DnsProvider
  email: EmailProvider
  domainBinding: DomainBindingProvider
}

// ── 认证凭证 ──────────────────────────────────────────────────

export interface CloudflareAuth {
  token?: string
  authEmail?: string
  globalApiKey?: string
}


