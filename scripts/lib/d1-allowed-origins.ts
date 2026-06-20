import { execFileSync } from 'node:child_process'

import { WORKER_DIR } from './local-config'
import { buildPagesDefaultOrigins } from './project-defaults'
import { parseWranglerJsonRows } from './wrangler-json'

const NPX_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx'

type D1Mode = 'local' | 'remote'

function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function runWranglerD1(databaseName: string, mode: D1Mode, args: string[]) {
  try {
    return execFileSync(
      NPX_BIN,
      ['wrangler', 'd1', 'execute', databaseName, mode === 'remote' ? '--remote' : '--local', '--json', ...args],
      {
        cwd: WORKER_DIR,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch (error) {
    const stdout = error && typeof error === 'object' && 'stdout' in error ? String((error as { stdout?: string }).stdout || '') : ''
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
    const message = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
    throw new Error(message || '执行 D1 allowed origins 同步失败')
  }
}

function normalizeOrigins(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort()
}

function normalizePagesOriginForMatch(origin: string) {
  return origin.replace('https://*.', 'https://placeholder.')
}

function isManagedPagesOrigin(origin: string) {
  try {
    const url = new URL(normalizePagesOriginForMatch(origin))
    return url.protocol === 'https:' && url.hostname.endsWith('.pages.dev')
  } catch {
    return false
  }
}

function mergeAllowedOrigins(existing: string[], projectSubdomain: string) {
  const preserved = existing.filter((origin) => !isManagedPagesOrigin(origin))
  return normalizeOrigins([...preserved, ...buildPagesDefaultOrigins(projectSubdomain)])
}

function readStoredAllowedOrigins(databaseName: string, mode: D1Mode) {
  const output = runWranglerD1(databaseName, mode, [
    '--command',
    "SELECT value FROM settings WHERE key = 'allowed_origins';",
  ])

  const row = parseWranglerJsonRows(output)[0]
  const value = row?.value
  if (typeof value !== 'string' || !value.trim()) {
    return []
  }

  const parsed = JSON.parse(value)
  if (!Array.isArray(parsed)) {
    throw new Error('D1 settings.allowed_origins 不是数组')
  }

  return normalizeOrigins(parsed.filter((item): item is string => typeof item === 'string'))
}

export function syncAllowedOriginsSetting(databaseName: string, mode: D1Mode, projectSubdomain: string) {
  const nextOrigins = mergeAllowedOrigins(readStoredAllowedOrigins(databaseName, mode), projectSubdomain)
  const payload = JSON.stringify(nextOrigins)

  runWranglerD1(databaseName, mode, [
    '--command',
    [
      `INSERT INTO settings (key, value, created_at, updated_at) VALUES ('allowed_origins', ${quoteSqlString(payload)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      `ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    ].join('\n'),
  ])

  return nextOrigins
}

export function mergeAllowedOriginsForTest(existing: string[], projectSubdomain: string) {
  return mergeAllowedOrigins(existing, projectSubdomain)
}
