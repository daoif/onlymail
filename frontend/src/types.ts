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
  routing_enabled: number
  cf_zone_id: string
  mx_record_ids: string
  txt_record_id: string | null
  route_rule_id: string | null
  created_at: string
}

export interface DashboardStats {
  totalAddresses: number
  totalMails: number
  totalDomains: number
  todayMailCount: number
}

export interface SettingsApiKeyState {
  configured: boolean
  preview: string | null
  rotatedAt: string | null
  adminUser: string
}
