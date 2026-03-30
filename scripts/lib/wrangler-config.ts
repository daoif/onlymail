import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '../..')
const TEMPLATE_PATH = resolve(ROOT_DIR, 'worker/wrangler.toml.template')
const OUTPUT_PATH = resolve(ROOT_DIR, 'worker/wrangler.toml')

export type WranglerConfigInput = {
  zoneId?: string
  accountId: string
  databaseId: string
  databaseName?: string
  workerName?: string
  pagesProjectName?: string
  allowedOrigins?: string
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
    zoneId: env.CF_DEFAULT_ZONE_ID?.trim() || '',
    accountId: requireValue(env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID, 'CF_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID'),
    databaseId: requireValue(env.D1_DATABASE_ID || env.DB_ID, 'D1_DATABASE_ID / DB_ID'),
    databaseName: env.D1_DATABASE_NAME?.trim() || 'mails-db',
    workerName: env.CF_DEFAULT_WORKER_NAME?.trim() || 'mails-worker',
    pagesProjectName: env.CF_DEFAULT_PAGES_PROJECT?.trim() || 'mails-frontend',
    allowedOrigins: env.ALLOWED_ORIGINS?.trim() || '',
  }
}

export function renderWranglerToml(input: WranglerConfigInput): string {
  const template = readFileSync(TEMPLATE_PATH, 'utf-8')
  const rendered = template
    .replace(/name = "mails-worker"/, `name = "${input.workerName || 'mails-worker'}"`)
    .replace(/CF_DEFAULT_WORKER_NAME = "mails-worker"/, `CF_DEFAULT_WORKER_NAME = "${input.workerName || 'mails-worker'}"`)
    .replace(
      '# CF_DEFAULT_ZONE_ID = "__ZONE_ID__"',
      input.zoneId ? `CF_DEFAULT_ZONE_ID = "${input.zoneId}"` : '# CF_DEFAULT_ZONE_ID = "可选：只在 init 自动配置某个 Zone 的 Email Routing 时需要"',
    )
    .replace('__ACCOUNT_ID__', input.accountId)
    .replace('__PAGES_PROJECT_NAME__', input.pagesProjectName || 'mails-frontend')
    .replace('__DATABASE_ID__', input.databaseId)
    .replace(/database_name = "mails-db"/, `database_name = "${input.databaseName || 'mails-db'}"`)

  if (rendered.includes('__')) {
    throw new Error('wrangler.toml 模板还有未替换的占位符')
  }

  if (input.allowedOrigins) {
    return rendered.replace(
      '# ALLOWED_ORIGINS = "https://你的-pages-subdomain.pages.dev,https://*.你的-pages-subdomain.pages.dev,http://localhost:5173"',
      `ALLOWED_ORIGINS = "${input.allowedOrigins}"`,
    )
  }

  return rendered
}

export function writeWranglerToml(input: WranglerConfigInput, outputPath = OUTPUT_PATH): string {
  const rendered = renderWranglerToml(input)
  writeFileSync(outputPath, rendered, 'utf-8')
  return outputPath
}
