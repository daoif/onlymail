/**
 * 初始化脚本 — 一键完成首次部署后的基础设施准备
 *
 * 用法：npx tsx scripts/init.ts
 *
 * 自动完成：
 * 1. 创建 D1 数据库 → 拿到 database_id
 * 2. 创建或确认 Pages 项目，准备默认 pages.dev 入口
 * 3. 把本地参数回写到 .env.local，并从模板生成 wrangler.toml
 * 4. 生成 worker/.dev.vars
 * 5. 设置 Worker secrets
 * 6. 部署 Worker，准备默认 workers.dev 入口
 * 7. 构建并部署前端
 * 8. 如果提供全局鉴权，则启用 Email Routing 并配置 catch-all
 * 9. 如果检测到 gh 和仓库名，则写 GitHub Secrets / Variables
 *
 * 前置条件：
 * - pnpm、wrangler CLI 已安装
 * - 已完成 `wrangler login`
 * - 如需完整自动化，提供 CF_API_TOKEN
 * - 如需 Email Routing 自动化，额外提供 CF_EMAIL + CF_GLOBAL_API_KEY
 *
 * 不处理：
 * - Worker / Pages 自定义域名绑定
 *   这部分留给应用内的初始化引导和设置页
 */

import { ROOT_DIR, WORKER_DIR, ensureJwtSecret, writeLocalEnvValues } from './lib/local-config'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CloudflareApiClient } from './lib/cloudflare-api'
import { writeWorkerDevVars } from './lib/dev-vars'
import { writeWranglerToml } from './lib/wrangler-config'

const FRONTEND_DIR = resolve(ROOT_DIR, 'frontend')
const TOML_PATH = resolve(WORKER_DIR, 'wrangler.toml')
const SCHEMA_PATH = resolve(WORKER_DIR, 'db/schema.sql')
const DB_NAME = 'mails-db'

type SetupContext = {
  zoneId: string
  accountId: string
  workerName: string
  pagesProjectName: string
  pagesProductionBranch: string
  allowedOrigins: string
  apiBaseUrl: string
  databaseId: string
  pagesDefaultUrl?: string
  cfApiToken?: string
  cfEmail?: string
  cfGlobalApiKey?: string
  githubRepo?: string
}

// ── 工具函数 ──────────────────────────────────────────────────

function run(cmd: string, cwd = WORKER_DIR): string {
  console.log(`\n> ${cmd}`)
  const output = execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] })
  if (output.trim()) console.log(output.trim())
  return output.trim()
}

function prompt(message: string): string {
  process.stdout.write(message)
  const buf = Buffer.alloc(1024)
  const fd = 0 // stdin
  let input = ''
  try {
    const bytesRead = require('node:fs').readSync(fd, buf, 0, buf.length, null)
    input = buf.toString('utf-8', 0, bytesRead).trim()
  } catch {
    // 非交互模式
  }
  return input
}

function detectExistingDatabaseId() {
  if (!existsSync(TOML_PATH)) {
    return ''
  }

  const content = readFileSync(TOML_PATH, 'utf-8')
  const match = content.match(/database_id\s*=\s*"([^"]+)"/)
  return match?.[1] || ''
}

function detectAccountId(): string {
  try {
    const output = run('npx wrangler whoami')
    const match = output.match(/Account ID:\s*([a-f0-9]{32})/i)
    return match?.[1] || ''
  } catch {
    return ''
  }
}

function putSecret(name: string, value: string) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      execSync(`npx wrangler secret put ${name}`, {
        cwd: WORKER_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        input: value,
      })
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

function deployFrontend(projectName: string, apiBaseUrl: string) {
  console.log('\n🖥️  步骤 7：部署前端 Pages...')
  try {
    execSync('pnpm build', {
      cwd: FRONTEND_DIR,
      encoding: 'utf-8',
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(apiBaseUrl ? { VITE_API_BASE_URL: apiBaseUrl } : {}),
      },
    })
    run(`npx wrangler pages deploy dist --project-name=${projectName}`, FRONTEND_DIR)
    console.log('✅ Frontend 部署完成')
  } catch {
    console.log('⚠️  前端部署失败，请手动执行:')
    console.log(`   cd frontend`)
    console.log(`   set VITE_API_BASE_URL=${apiBaseUrl}`)
    console.log(`   pnpm build`)
    console.log(`   npx wrangler pages deploy dist --project-name=${projectName}`)
  }
}

function canUseGhSetup(githubRepo?: string) {
  if (!githubRepo) {
    return false
  }

  try {
    execSync('gh --version', { stdio: 'ignore' })
    if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
      execSync('gh auth status', { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

function normalizeOriginList(...groups: string[]) {
  const values = groups.flatMap((group) =>
    group
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )

  return Array.from(new Set(values)).join(',')
}

function buildPagesAllowedOrigins(projectSubdomain: string, existing: string, customDomains: string[] = []) {
  return normalizeOriginList(
    existing,
    `https://${projectSubdomain}`,
    `https://*.${projectSubdomain}`,
    ...customDomains.map((domain) => `https://${domain}`),
    'http://localhost:5173',
  )
}

function buildWorkersDevUrl(workerName: string, accountSubdomain: string) {
  return `https://${workerName}.${accountSubdomain}.workers.dev`
}

// ── 主流程 ────────────────────────────────────────────────────

async function main() {
  console.log('=== Mails Worker 初始化脚本 ===')
  console.log()

  // 1. 检查前置条件
  if (!existsSync(SCHEMA_PATH)) {
    console.error(`❌ 找不到数据库 schema: ${SCHEMA_PATH}`)
    process.exit(1)
  }

  // 2. 收集配置
  const zoneId = process.env.CF_DEFAULT_ZONE_ID || prompt('请输入 CF Zone ID (CF_DEFAULT_ZONE_ID): ')
  if (!zoneId) {
    console.error('❌ 需要 Zone ID')
    process.exit(1)
  }

  const workerName = process.env.CF_DEFAULT_WORKER_NAME || 'mails-worker'
  const pagesProjectName = process.env.CF_DEFAULT_PAGES_PROJECT || 'mails-frontend'
  const pagesProductionBranch = process.env.CF_PAGES_PRODUCTION_BRANCH || 'master'
  const accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || detectAccountId() || prompt('请输入 CF Account ID (CF_ACCOUNT_ID): ')
  const cfApiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
  const cfEmail = process.env.CF_EMAIL || process.env.CF_AUTH_EMAIL || ''
  const cfGlobalApiKey = process.env.CF_GLOBAL_API_KEY || ''
  const githubRepo = process.env.GITHUB_REPOSITORY || process.env.GH_REPO || ''
  const client = cfApiToken ? new CloudflareApiClient({ token: cfApiToken, authEmail: cfEmail, globalApiKey: cfGlobalApiKey }) : null

  if (!accountId) {
    console.error('❌ 需要 Account ID')
    process.exit(1)
  }

  // 3. 创建 D1 数据库
  console.log('\n📦 步骤 1：创建 D1 数据库...')
  let databaseId = ''
  try {
    const output = run(`npx wrangler d1 create ${DB_NAME}`)
    const match = output.match(/database_id\s*=\s*"([^"]+)"/)
    if (match) {
      databaseId = match[1]
      console.log(`✅ 数据库已创建: ${databaseId}`)
    } else {
      console.log('⚠️  数据库可能已存在，请手动填入 database_id')
      databaseId = prompt('请输入 database_id: ')
    }
  } catch (error) {
    console.log('⚠️  创建数据库失败（可能已存在）')
    databaseId = process.env.D1_DATABASE_ID || process.env.DB_ID || detectExistingDatabaseId() || prompt('请输入已有的 database_id: ')
  }

  if (!databaseId) {
    console.error('❌ 需要 database_id')
    process.exit(1)
  }

  const jwtSecret = ensureJwtSecret()
  let pagesDefaultUrl = ''
  let allowedOrigins = normalizeOriginList(process.env.ALLOWED_ORIGINS || '', 'http://localhost:5173')
  let apiBaseUrl = process.env.VITE_API_BASE_URL || ''

  if (client) {
    console.log('\n🖥️  步骤 2：准备 Pages 项目和默认入口...')
    const [pagesProject, workersSubdomain, pagesDomains] = await Promise.all([
      client.ensurePagesProject(accountId, pagesProjectName, pagesProductionBranch),
      client.getWorkersSubdomain(accountId).catch(() => null),
      client.listPagesDomains(accountId, pagesProjectName).catch(() => []),
    ])

    pagesDefaultUrl = `https://${pagesProject.subdomain}`
    allowedOrigins = buildPagesAllowedOrigins(
      pagesProject.subdomain,
      process.env.ALLOWED_ORIGINS || '',
      pagesDomains.map((item) => item.name),
    )

    if (!apiBaseUrl && workersSubdomain?.subdomain) {
      apiBaseUrl = buildWorkersDevUrl(workerName, workersSubdomain.subdomain)
    }

    console.log(`✅ Pages 项目已就绪: ${pagesProject.name}`)
    console.log(`✅ Frontend 默认入口: ${pagesDefaultUrl}`)
    if (apiBaseUrl) {
      console.log(`✅ Worker 默认入口: ${apiBaseUrl}`)
    }
  } else {
    console.log('\n⚠️  未检测到 CF_API_TOKEN，跳过 Pages 项目和默认入口自动探测')
  }

  // 4. 同步本地配置并生成 wrangler.toml
  console.log('\n📝 步骤 3：同步 .env.local 并生成 wrangler.toml...')
  const envLocalPath = writeLocalEnvValues({
    CF_API_TOKEN: cfApiToken,
    CF_ACCOUNT_ID: accountId,
    CF_DEFAULT_ZONE_ID: zoneId,
    CF_EMAIL: cfEmail,
    CF_GLOBAL_API_KEY: cfGlobalApiKey,
    D1_DATABASE_ID: databaseId,
    CF_DEFAULT_WORKER_NAME: workerName,
    CF_DEFAULT_PAGES_PROJECT: pagesProjectName,
    GITHUB_REPOSITORY: githubRepo,
    JWT_SECRET: jwtSecret,
  })
  writeWranglerToml({
    zoneId,
    accountId,
    databaseId,
    databaseName: DB_NAME,
    workerName,
    pagesProjectName,
    allowedOrigins,
  })
  console.log(`✅ 已同步: ${envLocalPath}`)
  console.log(`✅ 已生成: ${TOML_PATH}`)

  // 5. 生成 worker/.dev.vars
  console.log('\n🧩 步骤 4：生成 worker/.dev.vars...')
  const devVarsPath = writeWorkerDevVars()
  console.log(`✅ 已生成: ${devVarsPath}`)

  // 6. 初始化数据库 schema
  console.log('\n🗃️  步骤 5：初始化数据库 schema...')
  try {
    run(`npx wrangler d1 execute ${DB_NAME} --remote --file=db/schema.sql`)
    console.log('✅ Schema 初始化完成')
  } catch {
    console.log('⚠️  远程 schema 初始化失败，尝试本地初始化...')
    try {
      run(`npx wrangler d1 execute ${DB_NAME} --local --file=db/schema.sql`)
      console.log('✅ 本地 Schema 初始化完成')
    } catch {
      console.log('⚠️  跳过 schema 初始化（可能已经存在）')
    }
  }

  // 7. 设置 Secrets
  console.log('\n🔐 步骤 6：设置 Secrets...')
  console.log('生成 JWT_SECRET...')

  try {
    putSecret('JWT_SECRET', jwtSecret)
    console.log('✅ JWT_SECRET 已设置')
  } catch {
    console.log('⚠️  设置 JWT_SECRET 失败，请手动执行:')
    console.log(`   echo "${jwtSecret}" | npx wrangler secret put JWT_SECRET`)
  }

  // CF API Token (如果有)
  if (cfApiToken) {
    try {
      putSecret('CF_API_TOKEN', cfApiToken)
      console.log('✅ CF_API_TOKEN 已设置')
    } catch {
      console.log('⚠️  设置 CF_API_TOKEN 失败，请手动设置')
    }
  }

  if (cfEmail) {
    try {
      putSecret('CF_EMAIL', cfEmail)
      putSecret('CF_AUTH_EMAIL', cfEmail)
      console.log('✅ CF_EMAIL / CF_AUTH_EMAIL 已设置')
    } catch {
      console.log('⚠️  设置 CF_EMAIL / CF_AUTH_EMAIL 失败，请手动设置')
    }
  }

  if (cfGlobalApiKey) {
    try {
      putSecret('CF_GLOBAL_API_KEY', cfGlobalApiKey)
      console.log('✅ CF_GLOBAL_API_KEY 已设置')
    } catch {
      console.log('⚠️  设置 CF_GLOBAL_API_KEY 失败，请手动设置')
    }
  }

  // 8. 部署 Worker
  console.log('\n🚀 步骤 7：部署 Worker...')
  try {
    run('npx wrangler deploy')
    console.log('✅ Worker 部署完成')
  } catch {
    console.log('⚠️  部署失败，请手动执行: cd worker && npx wrangler deploy')
  }

  const context: SetupContext = {
    zoneId,
    accountId,
    workerName,
    pagesProjectName,
    pagesProductionBranch,
    allowedOrigins,
    apiBaseUrl,
    databaseId,
    pagesDefaultUrl,
    cfApiToken,
    cfEmail,
    cfGlobalApiKey,
    githubRepo,
  }

  if (client) {
    console.log('\n🌐 步骤 8：确认默认入口并部署前端...')
    try {
      await client.ensureWorkerSubdomain(context.accountId, context.workerName)
      if (context.apiBaseUrl) {
        console.log(`✅ Worker 默认入口已可用: ${context.apiBaseUrl}`)
      }
    } catch {
      console.log('⚠️  无法自动确认 workers.dev，请在 Cloudflare 控制台检查 Worker 的 workers.dev 是否开启')
    }

    if (context.apiBaseUrl) {
      deployFrontend(context.pagesProjectName, context.apiBaseUrl)
    } else {
      console.log('⚠️  未能自动推导前端 API Base URL，跳过前端部署；请先提供 VITE_API_BASE_URL 再重试')
    }
  } else {
    console.log('\n⚠️  未检测到 CF_API_TOKEN，跳过 Pages 项目和前端自动部署')
  }

  if (cfEmail && cfGlobalApiKey && client) {
    console.log('\n📮 步骤 9：启用 Email Routing...')
    try {
      await client.enableEmailRouting(context.zoneId)
      await client.updateCatchAll(context.zoneId, context.workerName)
      console.log(`✅ Email Routing catch-all 已指向 Worker: ${context.workerName}`)
    } catch {
      console.log('⚠️  Email Routing 自动配置失败，请在 Cloudflare 控制台检查 catch-all -> Worker')
    }
  } else {
    console.log('\n⚠️  未检测到 CF_EMAIL + CF_GLOBAL_API_KEY，跳过 Email Routing 自动配置')
  }

  if (canUseGhSetup(githubRepo)) {
    console.log('\n🔧 步骤 10：写入 GitHub Secrets / Variables...')
    try {
      execSync('pnpm setup:github', {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        encoding: 'utf-8',
        env: {
          ...process.env,
          GITHUB_REPOSITORY: githubRepo,
          CLOUDFLARE_ACCOUNT_ID: accountId,
          CLOUDFLARE_API_TOKEN: cfApiToken,
          CF_DEFAULT_ZONE_ID: zoneId,
          D1_DATABASE_ID: databaseId,
          CF_DEFAULT_WORKER_NAME: workerName,
          CF_DEFAULT_PAGES_PROJECT: pagesProjectName,
          ALLOWED_ORIGINS: allowedOrigins,
          VITE_API_BASE_URL: apiBaseUrl,
        },
      })
      console.log('✅ GitHub 仓库配置已写入')
    } catch {
      console.log('⚠️  GitHub 配置写入失败，请稍后手动执行 pnpm setup:github')
    }
  } else if (githubRepo) {
    console.log('\n⚠️  检测到仓库名，但当前 gh 不可用，跳过 GitHub 自动配置')
  }

  // 8. 完成
  console.log('\n' + '='.repeat(50))
  console.log('🎉 初始化完成!')
  console.log()
  console.log('当前结果：')
  console.log(`1. Worker 默认地址: ${context.apiBaseUrl || '未自动探测，请手动提供 VITE_API_BASE_URL'}`)
  console.log(`2. Frontend 默认地址: ${context.pagesDefaultUrl || '未自动准备，请稍后手动部署 Pages'}`)
  console.log(`3. 默认允许来源: ${context.allowedOrigins || '未设置，当前按 Worker 运行时配置为准'}`)
  console.log()
  console.log('后续步骤：')
  console.log('1. 打开 Pages 默认地址，设置管理员账号密码')
  console.log('2. 在设置页面生成 API Key')
  console.log('3. 如需正式入口，再在设置页面绑定 Worker / Pages 自定义域名')
  console.log('4. 在域名页面初始化根域名 (bootstrap)')
  console.log('5. 创建一个真实地址并做一次收件测试')
}

main().catch((error) => {
  console.error('初始化失败:', error)
  process.exit(1)
})
