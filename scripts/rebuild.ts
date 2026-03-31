import './lib/local-config'
import { execSync } from 'node:child_process'

import { ROOT_DIR, writeLocalEnvValues } from './lib/local-config'

const DB_NAME = 'onlymail-db'

function run(command: string, env?: NodeJS.ProcessEnv) {
  console.log(`> ${command}`)
  execSync(command, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    encoding: 'utf-8',
    env: {
      ...process.env,
      ...env,
    },
  })
}

function tryDeleteDatabase() {
  try {
    const output = execSync(`npx wrangler d1 delete ${DB_NAME} -y`, {
      cwd: ROOT_DIR,
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf-8',
    })
    if (output.trim()) {
      console.log(output.trim())
    }
    return
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
    const stdout = error && typeof error === 'object' && 'stdout' in error ? String((error as { stdout?: string }).stdout || '') : ''
    const output = `${stdout}\n${stderr}`.toLowerCase()

    if (output.includes('not found') || output.includes('could not find') || output.includes('does not exist')) {
      console.log(`⚠️  未找到现有 D1 数据库 ${DB_NAME}，继续执行重建`)
      return
    }

    throw error
  }
}

async function main() {
  console.log('=== OnlyMail 重建脚本 ===')
  console.log()
  console.log('这会重建 D1，并重新部署 Worker / Frontend。')
  console.log('Cloudflare 上已有的 DNS、自定义域名和 Email Routing 外部入口不会处理。')

  console.log('\n🗑️  步骤 1：删除现有 D1 数据库...')
  tryDeleteDatabase()

  console.log('\n🧹 步骤 2：清空本地 D1_DATABASE_ID...')
  writeLocalEnvValues({
    D1_DATABASE_ID: '',
  }, ['JWT_SECRET'])
  console.log('✅ 已更新 .env.local')

  console.log('\n🚀 步骤 3：重新执行 init...')
  run('pnpm run init', {
    MAILS_INIT_REUSE_D1: 'false',
  })
}

main().catch((error) => {
  console.error('重建失败:', error)
  process.exit(1)
})
