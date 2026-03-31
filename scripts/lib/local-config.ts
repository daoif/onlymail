import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const ROOT_DIR = resolve(__dirname, '../..')
export const WORKER_DIR = resolve(ROOT_DIR, 'worker')
export const ENV_LOCAL_PATH = resolve(ROOT_DIR, '.env.local')
export const DEV_VARS_PATH = resolve(WORKER_DIR, '.dev.vars')

config({ path: ENV_LOCAL_PATH, quiet: true })

function formatEnvValue(value: string) {
  if (!value) {
    return ''
  }

  if (/^[A-Za-z0-9._:/@,-]+$/.test(value)) {
    return value
  }

  return JSON.stringify(value)
}

function upsertEnvContent(content: string, updates: Record<string, string>, removals: string[] = []) {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized ? normalized.split('\n') : []
  const remaining = new Map(Object.entries(updates))
  const removedKeys = new Set(removals)
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (!match) {
      return line
    }

    const key = match[1]
    if (removedKeys.has(key)) {
      return ''
    }

    if (!remaining.has(key)) {
      return line
    }

    const value = remaining.get(key) ?? ''
    remaining.delete(key)
    return `${key}=${formatEnvValue(value)}`
  })

  for (const [key, value] of remaining) {
    nextLines.push(`${key}=${formatEnvValue(value)}`)
  }

  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') {
    nextLines.pop()
  }

  return `${nextLines.join('\n')}\n`
}

export function writeLocalEnvValues(updates: Record<string, string>, removals: string[] = []) {
  const current = existsSync(ENV_LOCAL_PATH) ? readFileSync(ENV_LOCAL_PATH, 'utf-8') : ''
  const next = upsertEnvContent(current, updates, removals)
  writeFileSync(ENV_LOCAL_PATH, next, 'utf-8')

  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value
  }

  return ENV_LOCAL_PATH
}

export function ensureLocalEnvValue(name: string, createValue: () => string) {
  const existing = process.env[name]?.trim()
  if (existing) {
    return existing
  }

  const value = createValue()
  writeLocalEnvValues({ [name]: value })
  return value
}
