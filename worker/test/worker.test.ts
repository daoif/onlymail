import assert from 'node:assert/strict'
import test from 'node:test'

import handler from '../src/worker'

type FakePreparedStatement = {
  bind: (...values: unknown[]) => FakePreparedStatement
  first: <T>() => Promise<T | null>
  all: <T>() => Promise<{ results: T[] }>
  run: () => Promise<{ success: true }>
}

function createFakeEnv() {
  const statement: FakePreparedStatement = {
    bind() {
      return statement
    },
    async first<T>() {
      return null as T | null
    },
    async all<T>() {
      return { results: [] as T[] }
    },
    async run() {
      return { success: true as const }
    },
  }

  return {
    DB: {
      prepare() {
        return statement
      },
    } as unknown as D1Database,
    JWT_SECRET: 'test-secret',
    ALLOWED_ORIGINS: '',
  }
}

test('health 端点可访问', async () => {
  const response = await handler.fetch(new Request('https://example.com/health'), createFakeEnv(), {} as ExecutionContext)
  assert.equal(response.status, 200)
  const payload = await response.json() as { data: { ok: boolean } }
  assert.equal(payload.data.ok, true)
})

test('/api/* 在缺少 JWT 时返回 401', async () => {
  const response = await handler.fetch(new Request('https://example.com/api/dashboard'), createFakeEnv(), {} as ExecutionContext)
  assert.equal(response.status, 401)
})
