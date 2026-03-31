import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '../..')
const TEMPLATE_PATH = resolve(ROOT_DIR, 'worker/wrangler.toml.template')
const OUTPUT_PATH = resolve(ROOT_DIR, 'worker/wrangler.toml')

export type WranglerConfigInput = {
  accountId: string
  databaseId: string
  databaseName?: string
}

function requireValue(value: string | undefined, label: string): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(`缺少 ${label}`)
  }
  return trimmed
}

export function resolveWranglerConfigFromEnv(env: NodeJS.ProcessEnv): WranglerConfigInput {
  return {
    accountId: requireValue(env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID, 'CF_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID'),
    databaseId: requireValue(env.D1_DATABASE_ID || env.DB_ID, 'D1_DATABASE_ID / DB_ID'),
    databaseName: env.D1_DATABASE_NAME?.trim() || 'mails-db',
  }
}

export function renderWranglerToml(input: WranglerConfigInput): string {
  const template = readFileSync(TEMPLATE_PATH, 'utf-8')
  const rendered = template
    .replace('__ACCOUNT_ID__', input.accountId)
    .replace('__DATABASE_ID__', input.databaseId)
    .replace(/database_name = "mails-db"/, `database_name = "${input.databaseName || 'mails-db'}"`)

  if (rendered.includes('__')) {
    throw new Error('wrangler.toml 模板还有未替换的占位符')
  }

  return rendered
}

export function writeWranglerToml(input: WranglerConfigInput, outputPath = OUTPUT_PATH): string {
  const rendered = renderWranglerToml(input)
  writeFileSync(outputPath, rendered, 'utf-8')
  return outputPath
}
