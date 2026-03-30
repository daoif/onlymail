import './lib/local-config'
import { execSync } from 'node:child_process'
import { CloudflareApiClient } from './lib/cloudflare-api'

type ConfigValue = {
  value: string
  required: boolean
  kind: 'secret' | 'variable'
}

function shouldSkipSecrets() {
  const value = readValue('SETUP_GITHUB_SKIP_SECRETS')
  return value === '1' || value.toLowerCase() === 'true'
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

function run(command: string) {
  console.log(`> ${command}`)
  execSync(command, { stdio: 'inherit', encoding: 'utf-8' })
}

function ensureGhReady() {
  try {
    run('gh --version')
    if (!readValue('GH_TOKEN', 'GITHUB_TOKEN')) {
      run('gh auth status')
    }
  } catch {
    console.error('缺少可用的 gh CLI，无法自动写 GitHub Secrets / Variables')
    process.exit(1)
  }
}

function setSecret(repo: string, name: string, value: string) {
  execSync(`gh secret set ${name} -R ${repo} --body @-`, {
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf-8',
  })
  console.log(`已写入 secret: ${name}`)
}

function setVariable(repo: string, name: string, value: string) {
  execSync(`gh variable set ${name} -R ${repo} --body @-`, {
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf-8',
  })
  console.log(`已写入 variable: ${name}`)
}

function buildWorkersDevUrl(workerName: string, accountSubdomain: string) {
  return `https://${workerName}.${accountSubdomain}.workers.dev`
}

function buildPagesAllowedOrigins(projectSubdomain: string, existing: string, customDomains: string[] = []) {
  const values = existing
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return Array.from(new Set([
    `https://${projectSubdomain}`,
    `https://*.${projectSubdomain}`,
    ...customDomains.map((domain) => `https://${domain}`),
    'http://localhost:5173',
    ...values,
  ])).join(',')
}

async function inferCloudflareDefaults() {
  const token = readValue('CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN')
  const accountId = readValue('CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID')
  const workerName = readValue('CF_DEFAULT_WORKER_NAME') || 'mails-worker'
  const pagesProjectName = readValue('CF_DEFAULT_PAGES_PROJECT') || 'mails-frontend'

  if (!token || !accountId) {
    return {
      workerName,
      pagesProjectName,
      apiBaseUrl: '',
      allowedOrigins: '',
    }
  }

  const client = new CloudflareApiClient({ token })
  const [workersSubdomain, pagesProject, pagesDomains] = await Promise.all([
    client.getWorkersSubdomain(accountId).catch(() => null),
    client.getPagesProject(accountId, pagesProjectName).catch(() => null),
    client.listPagesDomains(accountId, pagesProjectName).catch(() => []),
  ])

  return {
    workerName,
    pagesProjectName,
    apiBaseUrl: workersSubdomain?.subdomain ? buildWorkersDevUrl(workerName, workersSubdomain.subdomain) : '',
    allowedOrigins: pagesProject?.subdomain
      ? buildPagesAllowedOrigins(pagesProject.subdomain, readValue('ALLOWED_ORIGINS'), pagesDomains.map((item) => item.name))
      : '',
  }
}

async function main() {
  const repo = readValue('GITHUB_REPOSITORY', 'GH_REPO')
  if (!repo) {
    console.error('缺少 GITHUB_REPOSITORY 或 GH_REPO，例如 daoif/mails')
    process.exit(1)
  }

  ensureGhReady()
  const skipSecrets = shouldSkipSecrets()
  const inferred = await inferCloudflareDefaults()

  const config: Record<string, ConfigValue> = {
    CLOUDFLARE_ACCOUNT_ID: {
      value: readValue('CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID'),
      required: true,
      kind: 'secret',
    },
    CLOUDFLARE_API_TOKEN: {
      value: readValue('CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN'),
      required: true,
      kind: 'secret',
    },
    CF_DEFAULT_ZONE_ID: {
      value: readValue('CF_DEFAULT_ZONE_ID'),
      required: true,
      kind: 'variable',
    },
    D1_DATABASE_ID: {
      value: readValue('D1_DATABASE_ID', 'DB_ID'),
      required: true,
      kind: 'variable',
    },
    CF_DEFAULT_WORKER_NAME: {
      value: readValue('CF_DEFAULT_WORKER_NAME') || inferred.workerName,
      required: false,
      kind: 'variable',
    },
    CF_DEFAULT_PAGES_PROJECT: {
      value: readValue('CF_DEFAULT_PAGES_PROJECT') || inferred.pagesProjectName,
      required: false,
      kind: 'variable',
    },
    ALLOWED_ORIGINS: {
      value: readValue('ALLOWED_ORIGINS') || inferred.allowedOrigins,
      required: false,
      kind: 'variable',
    },
    VITE_API_BASE_URL: {
      value: readValue('VITE_API_BASE_URL') || inferred.apiBaseUrl,
      required: false,
      kind: 'variable',
    },
  }

  const missing = Object.entries(config)
    .filter(([, item]) => item.required && !item.value)
    .map(([name]) => name)

  if (missing.length > 0) {
    console.error(`缺少必需配置：${missing.join(', ')}`)
    process.exit(1)
  }

  for (const [name, item] of Object.entries(config)) {
    if (!item.value) {
      continue
    }

    if (skipSecrets && item.kind === 'secret') {
      continue
    }

    if (item.kind === 'secret') {
      setSecret(repo, name, item.value)
    } else {
      setVariable(repo, name, item.value)
    }
  }
}

main()
