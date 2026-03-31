import './lib/local-config'
import { execFileSync, execSync } from 'node:child_process'
import { inferGitHubRepository } from './lib/github-repo'

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
  execFileSync('gh', ['secret', 'set', name, '-R', repo, '--body', value], {
    stdio: ['ignore', 'inherit', 'inherit'],
    encoding: 'utf-8',
  })
  console.log(`已写入 secret: ${name}`)
}

function setVariable(repo: string, name: string, value: string) {
  execFileSync('gh', ['variable', 'set', name, '-R', repo, '--body', value], {
    stdio: ['ignore', 'inherit', 'inherit'],
    encoding: 'utf-8',
  })
  console.log(`已写入 variable: ${name}`)
}

function deleteVariable(repo: string, name: string) {
  try {
    execFileSync('gh', ['variable', 'delete', name, '-R', repo], {
      stdio: ['ignore', 'inherit', 'inherit'],
      encoding: 'utf-8',
    })
    console.log(`已删除旧 variable: ${name}`)
  } catch {
    // 变量不存在时直接忽略
  }
}

async function main() {
  const repo = inferGitHubRepository()
  if (!repo) {
    console.error('无法自动推导 GitHub 仓库。请先给当前仓库设置 origin 到 GitHub，或在 GitHub Actions 上下文里运行')
    process.exit(1)
  }

  ensureGhReady()
  const skipSecrets = shouldSkipSecrets()

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
    CF_EMAIL: {
      value: readValue('CF_EMAIL', 'CF_AUTH_EMAIL'),
      required: true,
      kind: 'secret',
    },
    CF_GLOBAL_API_KEY: {
      value: readValue('CF_GLOBAL_API_KEY'),
      required: true,
      kind: 'secret',
    },
    D1_DATABASE_ID: {
      value: readValue('D1_DATABASE_ID', 'DB_ID'),
      required: true,
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

  for (const name of ['CF_DEFAULT_WORKER_NAME', 'CF_DEFAULT_PAGES_PROJECT', 'ALLOWED_ORIGINS']) {
    deleteVariable(repo, name)
  }
}

main()
