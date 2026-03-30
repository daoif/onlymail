import './lib/local-config'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ROOT_DIR } from './lib/local-config'

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

function main() {
  const pagesProject = process.env.CF_DEFAULT_PAGES_PROJECT?.trim() || 'mails-frontend'
  const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim() || ''
  const buildEnv = apiBaseUrl
    ? {
        ...process.env,
        VITE_API_BASE_URL: apiBaseUrl,
      }
    : process.env

  run('pnpm build', FRONTEND_DIR, buildEnv)
  run(`npx wrangler pages deploy dist --project-name=${pagesProject}`, FRONTEND_DIR)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
