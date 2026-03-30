import './lib/local-config'
import { execSync } from 'node:child_process'
import { applyD1Migrations } from './lib/d1-migrations'
import { ROOT_DIR, WORKER_DIR } from './lib/local-config'

function run(command: string, cwd: string) {
  console.log(`> ${command}`)
  execSync(command, {
    cwd,
    encoding: 'utf-8',
    stdio: 'inherit',
  })
}

function main() {
  run('pnpm render:wrangler', ROOT_DIR)
  applyD1Migrations({ databaseName: 'mails-db', mode: 'remote' })
  run('npx wrangler deploy', WORKER_DIR)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
