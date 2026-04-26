import assert from 'node:assert/strict'
import test from 'node:test'

import { inferCloudflareDnsRecordLimit } from '../src/providers/cloudflare/dns'

test('inferCloudflareDnsRecordLimit 会按 Cloudflare 计划推断 DNS 记录上限', () => {
  assert.equal(
    inferCloudflareDnsRecordLimit({ plan: { legacy_id: 'pro' }, created_on: '2026-01-01T00:00:00Z' }),
    3500,
  )

  assert.equal(
    inferCloudflareDnsRecordLimit({ plan: { legacy_id: 'free' }, created_on: '2024-08-31T23:59:59Z' }),
    1000,
  )

  assert.equal(
    inferCloudflareDnsRecordLimit({ plan: { legacy_id: 'free' }, created_on: '2024-09-01T00:00:00Z' }),
    200,
  )
})
