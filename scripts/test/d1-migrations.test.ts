import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildMigrationWrapperSqlForTest,
  listD1MigrationFiles,
  parseWranglerD1RowsForTest,
} from '../lib/d1-migrations'

test('listD1MigrationFiles 会排序并过滤非 migration 文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mails-migrations-test-'))
  writeFileSync(join(dir, '0002_add_index.sql'), '-- second', 'utf-8')
  writeFileSync(join(dir, '0001_initial.sql'), '-- first', 'utf-8')
  writeFileSync(join(dir, 'notes.txt'), 'ignore', 'utf-8')

  const files = listD1MigrationFiles(dir)
  assert.deepEqual(files.map((file) => file.name), ['0001_initial.sql', '0002_add_index.sql'])
})

test('parseWranglerD1RowsForTest 能解析 wrangler --json 结果', () => {
  const rows = parseWranglerD1RowsForTest(JSON.stringify([
    {
      success: true,
      results: [{ name: '0001_initial.sql' }, { name: '0002_add_index.sql' }],
    },
  ]))

  assert.deepEqual(rows, [{ name: '0001_initial.sql' }, { name: '0002_add_index.sql' }])
})

test('buildMigrationWrapperSqlForTest 会追加 migration 记录且不显式包事务', () => {
  const sql = buildMigrationWrapperSqlForTest('0001_initial.sql', 'CREATE TABLE example (id INTEGER);')
  assert.match(sql, /CREATE TABLE example/)
  assert.match(sql, /INSERT INTO schema_migrations/)
  assert.doesNotMatch(sql, /BEGIN TRANSACTION;/)
  assert.doesNotMatch(sql, /COMMIT;/)
})
