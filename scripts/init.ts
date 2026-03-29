/**
 * 初始化脚本 — 一键完成首次部署后的环境配置
 *
 * 用法：npx tsx scripts/init.ts
 *
 * 自动完成：
 * 1. 创建 D1 数据库 → 拿到 database_id
 * 2. 初始化 schema
 * 3. 生成 JWT_SECRET 并设为 wrangler secret
 * 4. 设置 CF 鉴权 secret
 * 5. 从 .template 生成 wrangler.toml
 * 6. 部署 Worker
 *
 * 前置条件：
 * - pnpm、wrangler CLI 已安装
 * - CF_API_TOKEN 环境变量或 `wrangler login` 已完成
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKER_DIR = resolve(__dirname, '../worker')
const TEMPLATE_PATH = resolve(WORKER_DIR, 'wrangler.toml.template')
const TOML_PATH = resolve(WORKER_DIR, 'wrangler.toml')
const SCHEMA_PATH = resolve(WORKER_DIR, 'db/schema.sql')
const DB_NAME = 'mails-db'

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

function generateSecret(length = 32): string {
  return randomBytes(length).toString('hex')
}

// ── 主流程 ────────────────────────────────────────────────────

async function main() {
  console.log('=== Mails Worker 初始化脚本 ===')
  console.log()

  // 1. 检查前置条件
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`❌ 找不到模板文件: ${TEMPLATE_PATH}`)
    process.exit(1)
  }

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
  const allowedOrigins = process.env.ALLOWED_ORIGINS || ''

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
    databaseId = process.env.DB_ID || prompt('请输入已有的 database_id: ')
  }

  if (!databaseId) {
    console.error('❌ 需要 database_id')
    process.exit(1)
  }

  // 4. 从模板生成 wrangler.toml
  console.log('\n📝 步骤 2：生成 wrangler.toml...')
  let template = readFileSync(TEMPLATE_PATH, 'utf-8')
  template = template.replace('__ZONE_ID__', zoneId)
  template = template.replace('__DATABASE_ID__', databaseId)

  if (allowedOrigins) {
    template = template.replace(
      '# ALLOWED_ORIGINS = "https://mails.你的域名,http://localhost:5173"',
      `ALLOWED_ORIGINS = "${allowedOrigins}"`,
    )
  }

  writeFileSync(TOML_PATH, template, 'utf-8')
  console.log(`✅ 已生成: ${TOML_PATH}`)

  // 5. 初始化数据库 schema
  console.log('\n🗃️  步骤 3：初始化数据库 schema...')
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

  // 6. 设置 Secrets
  console.log('\n🔐 步骤 4：设置 Secrets...')
  const jwtSecret = generateSecret()
  console.log('生成 JWT_SECRET...')

  try {
    execSync(`echo "${jwtSecret}" | npx wrangler secret put JWT_SECRET`, {
      cwd: WORKER_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    console.log('✅ JWT_SECRET 已设置')
  } catch {
    console.log('⚠️  设置 JWT_SECRET 失败，请手动执行:')
    console.log(`   echo "${jwtSecret}" | npx wrangler secret put JWT_SECRET`)
  }

  // CF API Token (如果有)
  const cfApiToken = process.env.CF_API_TOKEN
  if (cfApiToken) {
    try {
      execSync(`echo "${cfApiToken}" | npx wrangler secret put CF_API_TOKEN`, {
        cwd: WORKER_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      console.log('✅ CF_API_TOKEN 已设置')
    } catch {
      console.log('⚠️  设置 CF_API_TOKEN 失败，请手动设置')
    }
  }

  // 7. 部署 Worker
  console.log('\n🚀 步骤 5：部署 Worker...')
  try {
    run('npx wrangler deploy')
    console.log('✅ Worker 部署完成')
  } catch {
    console.log('⚠️  部署失败，请手动执行: cd worker && npx wrangler deploy')
  }

  // 8. 完成
  console.log('\n' + '='.repeat(50))
  console.log('🎉 初始化完成!')
  console.log()
  console.log('后续步骤：')
  console.log('1. 打开前端，设置管理员账号密码')
  console.log('2. 在设置页面生成 API Key')
  console.log('3. 在域名页面初始化根域名 (bootstrap)')
  console.log()
  console.log('如需配置 GitHub Secrets（CI/CD），请将 wrangler.toml 内容')
  console.log('设置为 GitHub Secret `BACKEND_TOML`')
}

main().catch((error) => {
  console.error('初始化失败:', error)
  process.exit(1)
})
