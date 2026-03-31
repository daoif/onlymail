import { writeFileSync } from 'node:fs'
import { DEV_VARS_PATH } from './local-config'

const DEV_VAR_KEYS = [
  'CF_API_TOKEN',
  'CF_EMAIL',
  'CF_GLOBAL_API_KEY',
  'CF_ACCOUNT_ID',
] as const

function formatEnvValue(value: string) {
  if (!value) {
    return ''
  }

  if (/^[A-Za-z0-9._:/@,-]+$/.test(value)) {
    return value
  }

  return JSON.stringify(value)
}

function readValue(env: NodeJS.ProcessEnv, ...names: string[]) {
  for (const name of names) {
    const value = env[name]?.trim()
    if (value) {
      return value
    }
  }

  return ''
}

export function resolveDevVars(env: NodeJS.ProcessEnv = process.env) {
  return {
    CF_API_TOKEN: readValue(env, 'CF_API_TOKEN', 'CLOUDFLARE_API_TOKEN'),
    CF_EMAIL: readValue(env, 'CF_EMAIL', 'CF_AUTH_EMAIL'),
    CF_GLOBAL_API_KEY: readValue(env, 'CF_GLOBAL_API_KEY'),
    CF_ACCOUNT_ID: readValue(env, 'CF_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID'),
  }
}

export function writeWorkerDevVars(env: NodeJS.ProcessEnv = process.env) {
  const values = resolveDevVars(env)
  const content = DEV_VAR_KEYS.map((key) => `${key}=${formatEnvValue(values[key])}`).join('\n')
  writeFileSync(DEV_VARS_PATH, `${content}\n`, 'utf-8')
  return DEV_VARS_PATH
}
