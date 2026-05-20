import assert from 'node:assert/strict'
import test from 'node:test'

import type { AppBindings } from '../src/types'

import { cleanupD1Data } from '../src/services/d1-admin'
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
  }

  function calcSize() {
    return 110_592 + state.addresses.length * 3_000 + state.mails.length * 1_500
  }

  function countMails(predicate: (row: MailRow) => boolean) {
    return state.mails.filter(predicate).length
  }

  const db = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, ' ').trim()

      const statement = {
        bind() {
          return statement
        },
        async first<T>() {
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
