import './lib/local-config'
import { execSync } from 'node:child_process'
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
  run('npx wrangler deploy', WORKER_DIR)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
