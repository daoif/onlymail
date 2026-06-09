import type { AppBindings, D1AutoCleanupSettings, SubdomainDnsMode } from '../types'

import { revokeAllAdminSessions } from './admin-session'
import { AppError } from '../lib/http'
import { exec, one } from '../lib/db'
import { generateApiKey, getApiKeyPreview, sha256 } from '../lib/crypto'
import { DEFAULT_DEV_ALLOWED_ORIGINS } from '../lib/project-defaults'

export type SettingKey =
  | 'admin_user'
  | 'admin_pass_hash'
  | 'api_key_hash'
  | 'api_key_preview'
  | 'api_key_rotated_at'
  | 'allowed_origins'
  | 'update_latest_version'
  | 'update_latest_tag'
  | 'update_latest_release_url'
  | 'update_latest_published_at'
  | 'update_last_checked_at'
  | 'update_last_error'
  | 'update_dismissed_version'
  | 'update_notifications_disabled'
  | 'subdomain_rotation_limit'
  | 'subdomain_dns_mode'
  | 'd1_auto_cleanup_temporary_enabled'

type SettingRow = {
  key: SettingKey
  value: string
}

type AllowedOriginsCache = {
  expiresAt: number
  values: string[]
}

const ALLOWED_ORIGINS_CACHE_TTL_MS = 60_000
const DEFAULT_SUBDOMAIN_ROTATION_LIMIT = 5
const DEFAULT_SUBDOMAIN_DNS_MODE: SubdomainDnsMode = 'compatible'
const MIN_SUBDOMAIN_ROTATION_LIMIT = 1
const MAX_SUBDOMAIN_ROTATION_LIMIT = 500
export const D1_AUTO_CLEANUP_TRIGGER_USAGE_PERCENT = 95
export const D1_AUTO_CLEANUP_KEEP_TEMPORARY_ADDRESSES = 100
let allowedOriginsCache: AllowedOriginsCache | null = null

export async function getSettingValue(env: AppBindings, key: SettingKey) {
  return one<SettingRow>(env.DB.prepare('SELECT key, value FROM settings WHERE key = ?1').bind(key))
}

export async function setSettingValue(env: AppBindings, key: SettingKey, value: string) {
  await exec(
    env.DB.prepare(
      `INSERT INTO settings (key, value, created_at, updated_at)
       VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(key, value),
  )
}

function parseLegacyRotationLimit(value?: string) {
  const raw = value?.trim()
  if (!raw) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < MIN_SUBDOMAIN_ROTATION_LIMIT) {
    return null
  }

  return Math.min(parsed, MAX_SUBDOMAIN_ROTATION_LIMIT)
}

function normalizeSubdomainRotationLimit(value: number) {
  if (!Number.isFinite(value)) {
    throw new AppError(400, '轮换总数必须是数字')
  }

  const normalized = Math.floor(value)
  if (normalized < MIN_SUBDOMAIN_ROTATION_LIMIT || normalized > MAX_SUBDOMAIN_ROTATION_LIMIT) {
    throw new AppError(400, `轮换总数必须在 ${MIN_SUBDOMAIN_ROTATION_LIMIT} 到 ${MAX_SUBDOMAIN_ROTATION_LIMIT} 之间`)
  }

  return normalized
}

function normalizeSubdomainDnsMode(value?: string | null): SubdomainDnsMode {
  return value === 'minimal' ? 'minimal' : DEFAULT_SUBDOMAIN_DNS_MODE
}

function toBoolean(value: string | null | undefined) {
  return value === 'true'
}

export async function getSubdomainRotationLimit(env: AppBindings) {
  const row = await getSettingValue(env, 'subdomain_rotation_limit')
  const stored = row?.value ? Number.parseInt(row.value, 10) : Number.NaN
  if (Number.isFinite(stored) && stored >= MIN_SUBDOMAIN_ROTATION_LIMIT) {
    return Math.min(stored, MAX_SUBDOMAIN_ROTATION_LIMIT)
  }

  return parseLegacyRotationLimit(env.ONLYMAIL_MANAGED_SUBDOMAIN_LIMIT)
    ?? DEFAULT_SUBDOMAIN_ROTATION_LIMIT
}

export async function getSubdomainDnsMode(env: AppBindings) {
  const row = await getSettingValue(env, 'subdomain_dns_mode')
  return normalizeSubdomainDnsMode(row?.value)
}

export async function getDomainLifecycleSettings(env: AppBindings) {
  return {
    subdomainRotationLimit: await getSubdomainRotationLimit(env),
    subdomainDnsMode: await getSubdomainDnsMode(env),
  }
}

export async function updateDomainLifecycleSettings(
  env: AppBindings,
  payload: { subdomainRotationLimit: number; subdomainDnsMode: SubdomainDnsMode },
) {
  const subdomainRotationLimit = normalizeSubdomainRotationLimit(payload.subdomainRotationLimit)
  const subdomainDnsMode = normalizeSubdomainDnsMode(payload.subdomainDnsMode)
  await Promise.all([
    setSettingValue(env, 'subdomain_rotation_limit', String(subdomainRotationLimit)),
    setSettingValue(env, 'subdomain_dns_mode', subdomainDnsMode),
  ])

  return {
    subdomainRotationLimit,
    subdomainDnsMode,
  }
}

export async function getD1AutoCleanupSettings(env: AppBindings): Promise<D1AutoCleanupSettings> {
  const row = await getSettingValue(env, 'd1_auto_cleanup_temporary_enabled')
  return {
    enabled: toBoolean(row?.value),
    triggerUsagePercent: D1_AUTO_CLEANUP_TRIGGER_USAGE_PERCENT,
    keepTemporaryAddresses: D1_AUTO_CLEANUP_KEEP_TEMPORARY_ADDRESSES,
  }
}

export async function updateD1AutoCleanupSettings(env: AppBindings, payload: { enabled: boolean }): Promise<D1AutoCleanupSettings> {
  await setSettingValue(env, 'd1_auto_cleanup_temporary_enabled', payload.enabled ? 'true' : 'false')
  return {
    enabled: payload.enabled,
    triggerUsagePercent: D1_AUTO_CLEANUP_TRIGGER_USAGE_PERCENT,
    keepTemporaryAddresses: D1_AUTO_CLEANUP_KEEP_TEMPORARY_ADDRESSES,
  }
}

function normalizeOrigins(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort()
}

function clearAllowedOriginsCache() {
  allowedOriginsCache = null
}

async function setAllowedOrigins(env: AppBindings, values: string[]) {
  const normalized = normalizeOrigins(values)
  await setSettingValue(env, 'allowed_origins', JSON.stringify(normalized))
  clearAllowedOriginsCache()
  return normalized
}

export async function getAdminUsername(env: AppBindings) {
  const row = await getSettingValue(env, 'admin_user')
  return row?.value ?? null
}

export async function isAdminInitialized(env: AppBindings) {
  return Boolean(await getAdminUsername(env))
}

export async function initAdmin(env: AppBindings, username: string, password: string) {
  if (await isAdminInitialized(env)) {
    throw new AppError(403, '管理员账号已初始化')
  }

  const passwordHash = await sha256(password)

  await Promise.all([
    setSettingValue(env, 'admin_user', username),
    setSettingValue(env, 'admin_pass_hash', passwordHash),
  ])

  return {
    username,
  }
}

export async function verifyAdmin(env: AppBindings, username: string, password: string) {
  const [userRow, passwordRow] = await Promise.all([
    getSettingValue(env, 'admin_user'),
    getSettingValue(env, 'admin_pass_hash'),
  ])

  if (!userRow?.value || !passwordRow?.value) {
    return false
  }

  if (userRow.value !== username) {
    return false
  }

  const passwordHash = await sha256(password)
  return passwordHash === passwordRow.value
}

export async function changeAdminPassword(env: AppBindings, oldPassword: string, newPassword: string) {
  const username = await getAdminUsername(env)
  if (!username) {
    throw new AppError(503, '管理员账号尚未初始化')
  }

  const verified = await verifyAdmin(env, username, oldPassword)
  if (!verified) {
    throw new AppError(401, '旧密码错误')
  }

  await setSettingValue(env, 'admin_pass_hash', await sha256(newPassword))
  await revokeAllAdminSessions(env)
}

export async function getApiKeyConfig(env: AppBindings) {
  const [hashRow, previewRow, rotatedAtRow] = await Promise.all([
    getSettingValue(env, 'api_key_hash'),
    getSettingValue(env, 'api_key_preview'),
    getSettingValue(env, 'api_key_rotated_at'),
  ])

  return {
    configured: Boolean(hashRow?.value),
    hash: hashRow?.value ?? null,
    preview: previewRow?.value ?? null,
    rotatedAt: rotatedAtRow?.value ?? null,
  }
}

export async function verifyApiKey(env: AppBindings, candidate: string) {
  const config = await getApiKeyConfig(env)
  if (!config.hash) {
    return false
  }

  const hashed = await sha256(candidate)
  return hashed === config.hash
}

export async function rotateApiKey(env: AppBindings) {
  const apiKey = generateApiKey()
  const hash = await sha256(apiKey)
  const preview = getApiKeyPreview(apiKey)
  const rotatedAt = new Date().toISOString()

  await Promise.all([
    setSettingValue(env, 'api_key_hash', hash),
    setSettingValue(env, 'api_key_preview', preview),
    setSettingValue(env, 'api_key_rotated_at', rotatedAt),
  ])

  return {
    apiKey,
    preview,
    rotatedAt,
  }
}

export async function getAllowedOriginPatterns(env: AppBindings) {
  const defaultOrigins = normalizeOrigins(DEFAULT_DEV_ALLOWED_ORIGINS)

  if (allowedOriginsCache && allowedOriginsCache.expiresAt > Date.now()) {
    return normalizeOrigins([...defaultOrigins, ...allowedOriginsCache.values])
  }

  const row = await getSettingValue(env, 'allowed_origins')
  let storedOrigins: string[] = []
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed)) {
        storedOrigins = normalizeOrigins(parsed.filter((item): item is string => typeof item === 'string'))
      }
    } catch {
      throw new AppError(500, 'allowed_origins 配置格式无效')
    }
  }

  allowedOriginsCache = {
    values: storedOrigins,
    expiresAt: Date.now() + ALLOWED_ORIGINS_CACHE_TTL_MS,
  }

  return normalizeOrigins([...defaultOrigins, ...storedOrigins])
}

export async function addAllowedOriginPattern(env: AppBindings, origin: string) {
  const row = await getSettingValue(env, 'allowed_origins')
  const current = row?.value ? JSON.parse(row.value) : []
  const values = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string') : []
  return setAllowedOrigins(env, [...values, origin])
}

export async function removeAllowedOriginPattern(env: AppBindings, origin: string) {
  const row = await getSettingValue(env, 'allowed_origins')
  const current = row?.value ? JSON.parse(row.value) : []
  const values = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string') : []
  return setAllowedOrigins(
    env,
    values.filter((item) => item !== origin.trim()),
  )
}


