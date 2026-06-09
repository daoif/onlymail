export interface PaginationMeta {
  page: number
  size: number
  total: number
  totalPages: number
}

export interface ApiEnvelope<T> {
  data: T
}

export interface AddressRecord {
  id: number
  name: string
  domain: string
  project: string
  ttl_hours: number
  created_at: string
  updated_at: string
  mail_count?: number
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
  subdomain_type: 'root' | 'permanent' | 'temporary'
  routing_enabled: number
  cf_zone_id: string
  mx_record_ids: string
  txt_record_id: string | null
  route_rule_id: string | null
  created_at: string
  managed_dns_count?: number
  remaining_dns_count?: number
  manageable_dns_count?: number
  cf_dns_record_count?: number
  cf_dns_record_limit?: number
  dns_records_per_subdomain?: number
  permanent_subdomain_count?: number
  temporary_subdomain_count?: number
  subdomain_rotation_limit?: number
}

export interface DashboardStats {
  totalAddresses: number
  totalMails: number
  totalDomains: number
  todayMailCount: number
  d1Capacity: D1CapacityStats
}

export interface D1CapacityStats {
  sizeBytes: number
  sizeLabel: string
  limitBytes: number
  limitLabel: string
  remainingBytes: number
  remainingLabel: string
  usagePercent: number
  status: 'normal' | 'warning' | 'danger'
}

export interface D1CleanupResult {
  scope: 'mails' | 'addresses'
  target: 'temporary' | 'permanent'
  deletedMails: number
  deletedAddresses: number
  capacity: D1CapacityStats
}

export interface D1AutoCleanupSettings {
  enabled: boolean
  triggerUsagePercent: number
  keepTemporaryAddresses: number
}

export interface SettingsApiKeyState {
  configured: boolean
  preview: string | null
  rotatedAt: string | null
  adminUser: string
}

export interface DomainLifecycleSettings {
  subdomainRotationLimit: number
  subdomainDnsMode: 'compatible' | 'minimal'
  dnsRecordsPerSubdomain: number
}

export interface VersionUpdateState {
  currentVersion: string
  latestVersion: string | null
  latestTag: string | null
  latestReleaseUrl: string | null
  latestPublishedAt: string | null
  lastCheckedAt: string | null
  lastError: string | null
  notificationsDisabled: boolean
  dismissedVersion: string | null
  repositoryUrl: string
  releasesUrl: string
  updateGuideUrl: string
  updateAvailable: boolean
}
