import assert from 'node:assert/strict'
import test from 'node:test'

import type { AppBindings } from '../src/types'

import { AppError } from '../src/lib/http'
import { createAdminSession, revokeAdminSession, verifyAdminSession } from '../src/services/admin-session'

type FakeSessionRow = {
  id: number
  tokenHash: string
  username: string
  expiresAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

function createFakeEnv() {
  const sessions: FakeSessionRow[] = []
  let id = 1

  const db = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, ' ').trim()
      let boundValues: unknown[] = []

      return {
        bind(...values: unknown[]) {
          boundValues = values
          return this
        },
        async first<T>() {
          if (normalized.startsWith('SELECT id, username, expires_at, revoked_at FROM admin_sessions')) {
            const tokenHash = String(boundValues[0])
            const matched = sessions.find((session) => session.tokenHash === tokenHash)
            if (!matched) {
              return null as T | null
            }

            return {
              id: matched.id,
              username: matched.username,
              expires_at: matched.expiresAt,
              revoked_at: matched.revokedAt,
            } as T
          }

          return null as T | null
        },
        async all<T>() {
          return { results: [] as T[] }
        },
        async run() {
          if (normalized.startsWith('INSERT INTO admin_sessions')) {
            sessions.push({
              id: id++,
              tokenHash: String(boundValues[0]),
              username: String(boundValues[1]),
              expiresAt: String(boundValues[2]),
              revokedAt: null,
              lastUsedAt: null,
            })
            return { success: true as const }
          }

          if (normalized.startsWith("UPDATE admin_sessions SET last_used_at = strftime")) {
            const matched = sessions.find((session) => session.id === Number(boundValues[0]))
            if (matched) {
              matched.lastUsedAt = 'updated'
            }
            return { success: true as const }
          }

          if (normalized.startsWith("UPDATE admin_sessions SET revoked_at = strftime")) {
            const tokenHash = String(boundValues[0])
            const matched = sessions.find((session) => session.tokenHash === tokenHash)
            if (matched && !matched.revokedAt) {
              matched.revokedAt = 'revoked'
            }
            return { success: true as const }
          }

          throw new Error(`未处理的 SQL: ${normalized}`)
        },
      }
    },
  } as unknown as D1Database

  return {
    env: { DB: db } as AppBindings,
    sessions,
  }
}

test('管理员会话可以创建并验证', async () => {
  const { env, sessions } = createFakeEnv()

  const session = await createAdminSession(env, 'admin')
  assert.equal(session.username, 'admin')
  assert.equal(sessions.length, 1)

  const verified = await verifyAdminSession(env, session.token)
  assert.equal(verified.username, 'admin')
  assert.equal(sessions[0].lastUsedAt, 'updated')
})

test('管理员会话撤销后不能再验证', async () => {
  const { env } = createFakeEnv()

  const session = await createAdminSession(env, 'admin')
  await revokeAdminSession(env, session.token)

  await assert.rejects(
    () => verifyAdminSession(env, session.token),
    (error: unknown) => error instanceof AppError && error.status === 401,
  )
})
