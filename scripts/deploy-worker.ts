import './lib/local-config'
import { execSync } from 'node:child_process'
import { CloudflareApiClient } from './lib/cloudflare-api'
import { syncAllowedOriginsSetting } from './lib/d1-allowed-origins'
import { applyD1Migrations } from './lib/d1-migrations'
import { DEFAULT_PAGES_PROJECT } from './lib/project-defaults'
import { ROOT_DIR, WORKER_DIR } from './lib/local-config'

function run(command: string, cwd: string) {
  console.log(`> ${command}`)
  execSync(command, {
    cwd,
    encoding: 'utf-8',
    stdio: 'inherit',
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

async function syncDefaultAllowedOrigins() {
  const token = readValue('CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN')
  const accountId = readValue('CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID')
  if (!token || !accountId) {
    throw new Error('缺少 CF_API_TOKEN 或 CF_ACCOUNT_ID，无法同步默认允许来源')
  }

  const client = new CloudflareApiClient({ token })
  const pagesProject = await client.getPagesProject(accountId, DEFAULT_PAGES_PROJECT)
  if (!pagesProject?.subdomain) {
    throw new Error('无法读取 Pages 项目默认域名，无法同步默认允许来源')
  }

  syncAllowedOriginsSetting('mails-db', 'remote', pagesProject.subdomain)
}

async function main() {
  run('pnpm render:wrangler', ROOT_DIR)
  applyD1Migrations({ databaseName: 'mails-db', mode: 'remote' })
  await syncDefaultAllowedOrigins()
  run('npx wrangler deploy', WORKER_DIR)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
