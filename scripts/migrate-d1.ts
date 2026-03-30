import './lib/local-config'

import { applyD1Migrations, type D1MigrationMode } from './lib/d1-migrations'

const DB_NAME = 'mails-db'

function detectMode(): D1MigrationMode {
  if (process.argv.includes('--local')) {
    return 'local'
  }

  if (process.argv.includes('--remote')) {
    return 'remote'
  }

  return 'remote'
}

function main() {
  applyD1Migrations({
    databaseName: DB_NAME,
    mode: detectMode(),
  })
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
