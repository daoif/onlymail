import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeAllowedOriginsForTest } from '../lib/d1-allowed-origins'

test('mergeAllowedOriginsForTest 会替换旧的 pages.dev 默认来源并保留自定义域名', () => {
  const merged = mergeAllowedOriginsForTest(
    [
      'https://old-project.pages.dev',
      'https://*.old-project.pages.dev',
      'https://mails.ainiaini.xyz',
    ],
    'mails-frontend-arl.pages.dev',
  )

  assert.deepEqual(merged, [
    'https://*.mails-frontend-arl.pages.dev',
    'https://mails-frontend-arl.pages.dev',
    'https://mails.ainiaini.xyz',
  ])
})
