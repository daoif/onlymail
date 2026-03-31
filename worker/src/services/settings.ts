import type { AppBindings } from '../types'

import { AppError } from '../lib/http'
import { exec, one } from '../lib/db'
import { generateApiKey, getApiKeyPreview, sha256 } from '../lib/crypto'
import { DEFAULT_DEV_ALLOWED_ORIGINS } from '../lib/project-defaults'

type SettingKey =
  | 'admin_user'
  | 'admin_pass_hash'
  | 'api_key_hash'
  | 'api_key_preview'
  | 'api_key_rotated_at'
  | 'allowed_origins'

type SettingRow = {
  key: SettingKey
  value: string
}

type AllowedOriginsCache = {
  expiresAt: number
  values: string[]
}

const ALLOWED_ORIGINS_CACHE_TTL_MS = 60_000
let allowedOriginsCache: AllowedOriginsCache | null = null

async function getSetting(env: AppBindings, key: SettingKey) {
  return one<SettingRow>(env.DB.prepare('SELECT key, value FROM settings WHERE key = ?1').bind(key))
}

async function setSetting(env: AppBindings, key: SettingKey, value: string) {
  await exec(
    env.DB.prepare(
      `INSERT INTO settings (key, value, created_at, updated_at)
       VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(key, value),
  )
}

function normalizeOrigins(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort()
}

function clearAllowedOriginsCache() {
  allowedOriginsCache = null
}

async function setAllowedOrigins(env: AppBindings, values: string[]) {
  const normalized = normalizeOrigins(values)
  await setSetting(env, 'allowed_origins', JSON.stringify(normalized))
  clearAllowedOriginsCache()
  return normalized
}

export async function getAdminUsername(env: AppBindings) {
  const row = await getSetting(env, 'admin_user')
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
    setSetting(env, 'admin_user', username),
    setSetting(env, 'admin_pass_hash', passwordHash),
  ])

  return {
    username,
  }
}

export async function verifyAdmin(env: AppBindings, username: string, password: string) {
  const [userRow, passwordRow] = await Promise.all([
    getSetting(env, 'admin_user'),
    getSetting(env, 'admin_pass_hash'),
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

  await setSetting(env, 'admin_pass_hash', await sha256(newPassword))
}

export async function getApiKeyConfig(env: AppBindings) {
  const [hashRow, previewRow, rotatedAtRow] = await Promise.all([
    getSetting(env, 'api_key_hash'),
    getSetting(env, 'api_key_preview'),
    getSetting(env, 'api_key_rotated_at'),
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
    setSetting(env, 'api_key_hash', hash),
    setSetting(env, 'api_key_preview', preview),
    setSetting(env, 'api_key_rotated_at', rotatedAt),
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

  const row = await getSetting(env, 'allowed_origins')
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
  const row = await getSetting(env, 'allowed_origins')
  const current = row?.value ? JSON.parse(row.value) : []
  const values = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string') : []
  return setAllowedOrigins(env, [...values, origin])
}

export async function removeAllowedOriginPattern(env: AppBindings, origin: string) {
  const row = await getSetting(env, 'allowed_origins')
  const current = row?.value ? JSON.parse(row.value) : []
  const values = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string') : []
  return setAllowedOrigins(
    env,
    values.filter((item) => item !== origin.trim()),
  )
}


