import type { JwtVariables } from 'hono/jwt'

export interface AppBindings {
  DB: D1Database
  JWT_SECRET: string
  CF_API_TOKEN?: string
  CF_EMAIL?: string
  CF_AUTH_EMAIL?: string
  CF_GLOBAL_API_KEY?: string
  CF_DEFAULT_ZONE_ID?: string
  CF_DEFAULT_WORKER_NAME?: string
  CF_ACCOUNT_ID?: string
  CF_DEFAULT_PAGES_PROJECT?: string
  ALLOWED_ORIGINS?: string
}

export type AppEnv = {
  Bindings: AppBindings
  Variables: JwtVariables
}

export interface PageParams {
  page: number
  size: number
  offset: number
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


