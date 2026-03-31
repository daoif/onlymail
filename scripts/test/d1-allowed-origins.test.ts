import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeAllowedOriginsForTest } from '../lib/d1-allowed-origins'

test('mergeAllowedOriginsForTest 会替换旧的 pages.dev 默认来源并保留自定义域名', () => {
  const actualProjectSubdomain = 'actual-project-subdomain.pages.dev'

  const merged = mergeAllowedOriginsForTest(
    [
      'https://old-project.pages.dev',
      'https://*.old-project.pages.dev',
      'https://onlymail.ainiaini.xyz',
    ],
    actualProjectSubdomain,
  )

  assert.deepEqual(merged, [
    `https://*.${actualProjectSubdomain}`,
    `https://${actualProjectSubdomain}`,
    'https://onlymail.ainiaini.xyz',
  ])
})
