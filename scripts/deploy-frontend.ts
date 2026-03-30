import './lib/local-config'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ROOT_DIR } from './lib/local-config'
import { CloudflareApiClient } from './lib/cloudflare-api'

const FRONTEND_DIR = resolve(ROOT_DIR, 'frontend')

function run(command: string, cwd: string, env?: NodeJS.ProcessEnv) {
  console.log(`> ${command}`)
  execSync(command, {
    cwd,
    encoding: 'utf-8',
    stdio: 'inherit',
    ...(env ? { env } : {}),
  })
}

function readValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }

  return ''
}

function buildWorkersDevUrl(workerName: string, accountSubdomain: string) {
  return `https://${workerName}.${accountSubdomain}.workers.dev`
}

async function inferApiBaseUrl() {
  const token = readValue('CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN')
  const accountId = readValue('CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID')
  const workerName = readValue('CF_DEFAULT_WORKER_NAME') || 'mails-worker'

  if (!token || !accountId) {
    throw new Error('缺少 CF_API_TOKEN 或 CF_ACCOUNT_ID，无法自动推导 Worker 默认 workers.dev 地址')
  }

  const client = new CloudflareApiClient({ token })
  const workersSubdomain = await client.getWorkersSubdomain(accountId)
  if (!workersSubdomain?.subdomain) {
    throw new Error('无法读取 Cloudflare 账户的 workers.dev 子域名')
  }

  return buildWorkersDevUrl(workerName, workersSubdomain.subdomain)
}

async function main() {
  const pagesProject = readValue('CF_DEFAULT_PAGES_PROJECT') || 'mails-frontend'
  const apiBaseUrl = await inferApiBaseUrl()
  const buildEnv = {
    ...process.env,
    VITE_API_BASE_URL: apiBaseUrl,
  }

  run('pnpm build', FRONTEND_DIR, buildEnv)
  run(`npx wrangler pages deploy dist --project-name=${pagesProject}`, FRONTEND_DIR)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
