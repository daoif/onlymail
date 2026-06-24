import assert from 'node:assert/strict'
import test from 'node:test'

import type { AppBindings } from '../src/types'

import { handleScheduled } from '../src/scheduled'
import { cleanupExpiredAddresses } from '../src/services/address'
import { autoCleanupD1TemporaryData, cleanupD1Data } from '../src/services/d1-admin'
import { getDashboardStats } from '../src/services/stats'

type AddressRow = {
  name: string
  ttl_hours: number
  updated_at: string
  created_at: string
}

type MailRow = {
  address: string
  created_at: string
}

function createFakeEnv() {
  const state = {
    addresses: [
      { name: 'temp-1@example.com', ttl_hours: 24, updated_at: '2026-05-19T00:00:00.000Z', created_at: '2026-05-19T00:00:00.000Z' },
      { name: 'perm-1@example.com', ttl_hours: 0, updated_at: '2026-05-19T00:00:00.000Z', created_at: '2026-05-19T00:00:00.000Z' },
      { name: 'temp-2@example.com', ttl_hours: 24, updated_at: '2026-05-20T00:00:00.000Z', created_at: '2026-05-20T00:00:00.000Z' },
    ] as AddressRow[],
    mails: [
      { address: 'temp-1@example.com', created_at: '2026-05-20T01:00:00.000Z' },
      { address: 'temp-1@example.com', created_at: '2026-05-19T01:00:00.000Z' },
      { address: 'perm-1@example.com', created_at: '2026-05-20T02:00:00.000Z' },
      { address: 'temp-2@example.com', created_at: '2026-05-20T03:00:00.000Z' },
    ] as MailRow[],
    domains: 2,
    settings: new Map<string, string>(),
    fixedSize: null as number | null,
    capacityQueryCount: 0,
    failExpiredAddressCleanup: false,
  }

  function calcSize() {
    if (state.fixedSize !== null) {
      return state.fixedSize
    }

    return 110_592 + state.addresses.length * 3_000 + state.mails.length * 1_500
  }

  function countMails(predicate: (row: MailRow) => boolean) {
    return state.mails.filter(predicate).length
  }

  function selectOldTemporaryAddressNames(keepCount: number, batchSize: number) {
    const kept = new Set(
      state.addresses
        .filter((row) => row.ttl_hours > 0)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.name.localeCompare(a.name))
        .slice(0, keepCount)
        .map((row) => row.name),
    )

    return state.addresses
      .filter((row) => row.ttl_hours > 0 && !kept.has(row.name))
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.name.localeCompare(b.name))
      .slice(0, batchSize)
      .map((row) => row.name)
  }

  function selectExpiredTemporaryAddressNames(batchSize: number) {
    return state.addresses
      .filter((row) => row.ttl_hours > 0)
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.name.localeCompare(b.name))
      .slice(0, batchSize)
      .map((row) => row.name)
  }

  const db = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, ' ').trim()
      let boundValues: unknown[] = []

      const statement = {
        bind(...values: unknown[]) {
          boundValues = values
          return statement
        },
        async first<T>() {
          if (normalized === 'SELECT key, value FROM settings WHERE key = ?1') {
            const key = String(boundValues[0])
            const value = state.settings.get(key)
            return value === undefined ? null as T | null : { key, value } as T
          }

          if (normalized === 'SELECT COUNT(*) AS total FROM address') {
            return { total: state.addresses.length } as T
          }

          if (normalized === 'SELECT COUNT(*) AS total FROM raw_mails') {
            return { total: state.mails.length } as T
          }

          if (normalized === 'SELECT COUNT(*) AS total FROM domains') {
            return { total: state.domains } as T
          }

          if (normalized.includes("WHERE date(created_at) = date('now')")) {
            return { total: countMails((row) => row.created_at.startsWith('2026-05-20')) } as T
          }

          return null as T | null
        },
        async all<T>() {
          if (normalized === 'SELECT 1 AS ok') {
            state.capacityQueryCount += 1
            return {
              results: [{ ok: 1 }] as T[],
              meta: {
                size_after: calcSize(),
                changes: 0,
                rows_read: 0,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: false,
              },
            }
          }

          return {
            results: [] as T[],
            meta: {
              size_after: calcSize(),
              changes: 0,
              rows_read: 0,
              rows_written: 0,
              duration: 0,
              last_row_id: 0,
              changed_db: false,
            },
          }
        },
        async run() {
          if (normalized.startsWith('INSERT INTO settings')) {
            state.settings.set(String(boundValues[0]), String(boundValues[1]))
            return {
              meta: {
                size_after: calcSize(),
                changes: 1,
                rows_read: 0,
                rows_written: 1,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized.includes('DELETE FROM raw_mails WHERE address IN ( SELECT name FROM address WHERE ttl_hours > 0 )')) {
            const affectedNames = new Set(state.addresses.filter((row) => row.ttl_hours > 0).map((row) => row.name))
            const before = state.mails.length
            state.mails = state.mails.filter((row) => !affectedNames.has(row.address))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.mails.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized.includes('DELETE FROM raw_mails WHERE address IN ( SELECT name FROM address WHERE ttl_hours = 0 )')) {
            const affectedNames = new Set(state.addresses.filter((row) => row.ttl_hours === 0).map((row) => row.name))
            const before = state.mails.length
            state.mails = state.mails.filter((row) => !affectedNames.has(row.address))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.mails.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized.startsWith('DELETE FROM raw_mails WHERE address IN (SELECT name FROM address WHERE ttl_hours > 0 AND name NOT IN')) {
            const affectedNames = new Set(selectOldTemporaryAddressNames(Number(boundValues[0]), Number(boundValues[1])))
            const before = state.mails.length
            state.mails = state.mails.filter((row) => !affectedNames.has(row.address))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.mails.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized.startsWith('DELETE FROM address WHERE name IN (SELECT name FROM address WHERE ttl_hours > 0 AND name NOT IN')) {
            const affectedNames = new Set(selectOldTemporaryAddressNames(Number(boundValues[0]), Number(boundValues[1])))
            const before = state.addresses.length
            state.addresses = state.addresses.filter((row) => !affectedNames.has(row.name))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.addresses.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized.startsWith('DELETE FROM raw_mails WHERE address IN (SELECT name FROM address WHERE ttl_hours > 0 AND datetime(updated_at)')) {
            if (state.failExpiredAddressCleanup) {
              throw new Error('TTL cleanup failed')
            }

            const affectedNames = new Set(selectExpiredTemporaryAddressNames(Number(boundValues[0])))
            const before = state.mails.length
            state.mails = state.mails.filter((row) => !affectedNames.has(row.address))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.mails.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized.startsWith('DELETE FROM address WHERE name IN (SELECT name FROM address WHERE ttl_hours > 0 AND datetime(updated_at)')) {
            const affectedNames = new Set(selectExpiredTemporaryAddressNames(Number(boundValues[0])))
            const before = state.addresses.length
            state.addresses = state.addresses.filter((row) => !affectedNames.has(row.name))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.addresses.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized === 'DELETE FROM address WHERE ttl_hours > 0') {
            const before = state.addresses.length
            const affectedNames = new Set(state.addresses.filter((row) => row.ttl_hours > 0).map((row) => row.name))
            state.addresses = state.addresses.filter((row) => row.ttl_hours <= 0)
            state.mails = state.mails.filter((row) => !affectedNames.has(row.address))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.addresses.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized === 'DELETE FROM address WHERE ttl_hours = 0') {
            const before = state.addresses.length
            const affectedNames = new Set(state.addresses.filter((row) => row.ttl_hours === 0).map((row) => row.name))
            state.addresses = state.addresses.filter((row) => row.ttl_hours > 0)
            state.mails = state.mails.filter((row) => !affectedNames.has(row.address))
            return {
              meta: {
                size_after: calcSize(),
                changes: before - state.addresses.length,
                rows_read: before,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: true,
              },
            }
          }

          if (normalized.startsWith('DELETE FROM admin_sessions WHERE revoked_at IS NOT NULL OR expires_at <=')) {
            return {
              meta: {
                size_after: calcSize(),
                changes: 0,
                rows_read: 0,
                rows_written: 0,
                duration: 0,
                last_row_id: 0,
                changed_db: false,
              },
            }
          }

          throw new Error(`未处理的 SQL: ${normalized}`)
        },
      }

      return statement
    },
    async batch(statements: Array<{ run: () => Promise<{ meta: { size_after: number; changes: number; rows_read: number; rows_written: number; duration: number; last_row_id: number; changed_db: boolean } }> }>) {
      const results = []
      for (const statement of statements) {
        results.push(await statement.run())
      }
      return results
    },
  } as unknown as D1Database

  return {
    env: { DB: db } as AppBindings,
    state,
  }
}

test('getDashboardStats 会返回容量信息', async () => {
  const { env } = createFakeEnv()
  const stats = await getDashboardStats(env)

  assert.equal(stats.totalAddresses, 3)
  assert.equal(stats.totalMails, 4)
  assert.equal(stats.totalDomains, 2)
  assert.equal(stats.todayMailCount, 3)
  assert.equal(stats.d1Capacity.status, 'normal')
  assert.match(stats.d1Capacity.sizeLabel, /MB$/)
})

test('cleanupD1Data 清理临时邮件时只删除对应邮件', async () => {
  const { env, state } = createFakeEnv()
  const result = await cleanupD1Data(env, 'mails', 'temporary')

  assert.equal(result.scope, 'mails')
  assert.equal(result.target, 'temporary')
  assert.equal(result.deletedMails, 3)
  assert.equal(result.deletedAddresses, 0)
  assert.equal(state.addresses.length, 3)
  assert.equal(state.mails.length, 1)
})

test('cleanupD1Data 清理永久邮箱时会连同邮件一起删除', async () => {
  const { env, state } = createFakeEnv()
  const result = await cleanupD1Data(env, 'addresses', 'permanent')

  assert.equal(result.scope, 'addresses')
  assert.equal(result.target, 'permanent')
  assert.equal(result.deletedAddresses, 1)
  assert.equal(result.deletedMails, 1)
  assert.equal(state.addresses.some((row) => row.ttl_hours === 0), false)
  assert.equal(state.mails.some((row) => row.address === 'perm-1@example.com'), false)
})

test('cleanupExpiredAddresses 分批清理临时邮箱并保留永久邮箱', async () => {
  const { env, state } = createFakeEnv()
  const result = await cleanupExpiredAddresses(env)

  assert.equal(result.addressCount, 2)
  assert.equal(result.mailCount, 3)
  assert.equal(result.batchCount, 1)
  assert.deepEqual(state.addresses.map((row) => row.name), ['perm-1@example.com'])
  assert.deepEqual(state.mails.map((row) => row.address), ['perm-1@example.com'])
})

test('autoCleanupD1TemporaryData 未开启时不检查容量', async () => {
  const { env, state } = createFakeEnv()
  const result = await autoCleanupD1TemporaryData(env)

  assert.equal(result.triggered, false)
  assert.equal(result.reason, 'disabled')
  assert.equal(result.deletedAddresses, 0)
  assert.equal(state.capacityQueryCount, 0)
})

test('autoCleanupD1TemporaryData 低于 95% 时不清理', async () => {
  const { env, state } = createFakeEnv()
  state.settings.set('d1_auto_cleanup_temporary_enabled', 'true')
  state.fixedSize = 400_000_000

  const result = await autoCleanupD1TemporaryData(env)

  assert.equal(result.triggered, false)
  assert.equal(result.reason, 'below_threshold')
  assert.equal(result.deletedAddresses, 0)
  assert.equal(state.addresses.length, 3)
  assert.equal(state.capacityQueryCount, 1)
})

test('autoCleanupD1TemporaryData 达到 95% 后只保留最近活跃的 100 个临时邮箱', async () => {
  const { env, state } = createFakeEnv()
  state.settings.set('d1_auto_cleanup_temporary_enabled', 'true')
  state.fixedSize = 480_000_000
  state.addresses = [
    { name: 'perm@example.com', ttl_hours: 0, updated_at: '2026-05-01T00:00:00.000Z', created_at: '2026-05-01T00:00:00.000Z' },
    ...Array.from({ length: 105 }, (_, index) => {
      const id = String(index + 1).padStart(3, '0')
      const timestamp = new Date(Date.UTC(2026, 4, 1, 0, index)).toISOString()
      return {
        name: `temp-${id}@example.com`,
        ttl_hours: 24,
        updated_at: timestamp,
        created_at: timestamp,
      }
    }),
  ]
  state.mails = state.addresses.map((row) => ({ address: row.name, created_at: row.updated_at }))

  const result = await autoCleanupD1TemporaryData(env)

  assert.equal(result.triggered, true)
  assert.equal(result.reason, 'completed')
  assert.equal(result.deletedAddresses, 5)
  assert.equal(result.deletedMails, 5)
  assert.equal(state.addresses.filter((row) => row.ttl_hours > 0).length, 100)
  assert.equal(state.addresses.some((row) => row.name === 'perm@example.com'), true)
  assert.equal(state.addresses.some((row) => row.name === 'temp-001@example.com'), false)
  assert.equal(state.addresses.some((row) => row.name === 'temp-105@example.com'), true)
  assert.equal(state.mails.some((row) => row.address === 'temp-001@example.com'), false)
  assert.equal(state.mails.some((row) => row.address === 'temp-105@example.com'), true)
})

test('handleScheduled 记录每步日志，且 TTL 清理失败不会阻断 D1 自动清理', async () => {
  const { env, state } = createFakeEnv()
  state.settings.set('d1_auto_cleanup_temporary_enabled', 'true')
  state.settings.set('update_last_checked_at', new Date().toISOString())
  state.fixedSize = 480_000_000
  state.failExpiredAddressCleanup = true
  state.addresses = [
    { name: 'perm@example.com', ttl_hours: 0, updated_at: '2026-05-01T00:00:00.000Z', created_at: '2026-05-01T00:00:00.000Z' },
    ...Array.from({ length: 105 }, (_, index) => {
      const id = String(index + 1).padStart(3, '0')
      const timestamp = new Date(Date.UTC(2026, 4, 1, 0, index)).toISOString()
      return {
        name: `temp-${id}@example.com`,
        ttl_hours: 24,
        updated_at: timestamp,
        created_at: timestamp,
      }
    }),
  ]
  state.mails = state.addresses.map((row) => ({ address: row.name, created_at: row.updated_at }))

  const originalInfo = console.info
  const originalError = console.error
  const logs: Array<Record<string, unknown>> = []
  console.info = (message?: unknown) => {
    logs.push(JSON.parse(String(message)))
  }
  console.error = (message?: unknown) => {
    logs.push(JSON.parse(String(message)))
  }

  try {
    await handleScheduled({ cron: '0 * * * *', scheduledTime: Date.now() } as ScheduledController, env)
  } finally {
    console.info = originalInfo
    console.error = originalError
  }

  const ttlLog = logs.find((entry) => entry.step === 'ttl_cleanup')
  const autoCleanupLog = logs.find((entry) => entry.step === 'd1_auto_cleanup')
  const completeLog = logs.find((entry) => entry.step === 'complete')

  assert.equal(ttlLog?.status, 'error')
  assert.equal(autoCleanupLog?.status, 'ok')
  assert.equal(autoCleanupLog?.triggered, true)
  assert.equal(autoCleanupLog?.deleted_addresses, 5)
  assert.equal(completeLog?.status, 'ok')
  assert.equal(state.addresses.filter((row) => row.ttl_hours > 0).length, 100)
})
