import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { ROOT_DIR, WORKER_DIR } from './local-config'
import { parseWranglerJsonRows } from './wrangler-json'

const NPX_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const MIGRATIONS_DIR = resolve(ROOT_DIR, 'worker/db/migrations')
const MIGRATION_TABLE = 'schema_migrations'

export type D1MigrationMode = 'local' | 'remote'

export type D1MigrationFile = {
  name: string
  path: string
}

type ApplyD1MigrationsOptions = {
  databaseName: string
  mode: D1MigrationMode
  cwd?: string
}

function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function buildMigrationWrapperSql(name: string, sql: string) {
  return [
    sql.trim(),
    `INSERT INTO ${MIGRATION_TABLE} (name, applied_at) VALUES (${quoteSqlString(name)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`,
    '',
  ].join('\n')
}

function runWranglerD1Json(options: ApplyD1MigrationsOptions, extraArgs: string[]) {
  const args = [
    'wrangler',
    'd1',
    'execute',
    options.databaseName,
    options.mode === 'remote' ? '--remote' : '--local',
    '--json',
    ...extraArgs,
  ]

  try {
    return execFileSync(NPX_BIN, args, {
      cwd: options.cwd || WORKER_DIR,
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stdout = error && typeof error === 'object' && 'stdout' in error ? String((error as { stdout?: string }).stdout || '') : ''
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: string }).stderr || '') : ''
    const message = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
    throw new Error(message || '执行 wrangler d1 命令失败')
  }
}

function ensureMigrationTable(options: ApplyD1MigrationsOptions) {
  runWranglerD1Json(options, [
    '--command',
    `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`,
  ])
}

function getAppliedMigrationNames(options: ApplyD1MigrationsOptions) {
  ensureMigrationTable(options)
  const output = runWranglerD1Json(options, [
    '--command',
    `SELECT name FROM ${MIGRATION_TABLE} ORDER BY name;`,
  ])

  return new Set(
    parseWranglerJsonRows(output)
      .map((row) => row.name)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )
}

function createTempMigrationFile(name: string, sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'onlymail-d1-migration-'))
  const path = join(dir, `${name}.sql`)
  writeFileSync(path, buildMigrationWrapperSql(name, sql), 'utf-8')
  return { dir, path }
}

function applySingleMigration(options: ApplyD1MigrationsOptions, migration: D1MigrationFile) {
  const sql = readFileSync(migration.path, 'utf-8')
  const temp = createTempMigrationFile(migration.name, sql)

  try {
    runWranglerD1Json(options, ['--file', temp.path])
  } finally {
    rmSync(temp.dir, { recursive: true, force: true })
  }
}

export function listD1MigrationFiles(dir = MIGRATIONS_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d{4}_.+\.sql$/.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      path: resolve(dir, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function ensureD1MigrationsExist() {
  const files = listD1MigrationFiles()
  if (files.length === 0) {
    throw new Error(`找不到 D1 migration 文件：${MIGRATIONS_DIR}`)
  }

  return files
}

export function applyD1Migrations(options: ApplyD1MigrationsOptions) {
  const migrations = ensureD1MigrationsExist()
  const appliedNames = getAppliedMigrationNames(options)
  const pending = migrations.filter((migration) => !appliedNames.has(migration.name))
  const skipped = migrations.filter((migration) => appliedNames.has(migration.name)).map((migration) => migration.name)

  if (pending.length === 0) {
    console.log(`✅ D1 ${options.mode} migration 已是最新，无需执行`)
    return { applied: [] as string[], skipped }
  }

  console.log(`🗃️  开始执行 D1 ${options.mode} migration，共 ${pending.length} 个`)
  const applied: string[] = []

  for (const migration of pending) {
    console.log(`   -> ${migration.name}`)
    applySingleMigration(options, migration)
    applied.push(migration.name)
  }

  console.log(`✅ D1 ${options.mode} migration 完成`)
  return { applied, skipped }
}

export function parseWranglerD1RowsForTest(output: string) {
  return parseWranglerJsonRows(output)
}

export function buildMigrationWrapperSqlForTest(name: string, sql: string) {
  return buildMigrationWrapperSql(name, sql)
}
