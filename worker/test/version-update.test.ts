import assert from 'node:assert/strict'
import test from 'node:test'

import { compareVersions, normalizeVersion } from '../../shared/version'
import { shouldShowUpdateBanner } from '../src/services/version-update'

test('normalizeVersion 会处理 v 前缀和非法版本', () => {
  assert.equal(normalizeVersion('v0.2.0'), '0.2.0')
  assert.equal(normalizeVersion('0.2.0'), '0.2.0')
  assert.equal(normalizeVersion('main'), null)
})

test('compareVersions 会按语义化版本号比较', () => {
  assert.equal(compareVersions('0.2.0', '0.1.0') > 0, true)
  assert.equal(compareVersions('0.1.0', '0.2.0') < 0, true)
  assert.equal(compareVersions('0.1.0', '0.1.0'), 0)
})

test('shouldShowUpdateBanner 会按关闭状态和最新版本判断', () => {
  assert.equal(
    shouldShowUpdateBanner({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      latestTag: 'v0.2.0',
      latestReleaseUrl: 'https://example.com/release',
      latestPublishedAt: '2026-03-31T00:00:00.000Z',
      lastCheckedAt: '2026-03-31T00:00:00.000Z',
      lastError: null,
      notificationsDisabled: false,
      dismissedVersion: null,
      repositoryUrl: 'https://github.com/daoif/onlymail',
      releasesUrl: 'https://github.com/daoif/onlymail/releases',
      updateGuideUrl: 'https://github.com/daoif/onlymail/blob/master/DOCS/UPDATE.md',
      updateAvailable: true,
    }),
    true,
  )

  assert.equal(
    shouldShowUpdateBanner({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      latestTag: 'v0.2.0',
      latestReleaseUrl: 'https://example.com/release',
      latestPublishedAt: '2026-03-31T00:00:00.000Z',
      lastCheckedAt: '2026-03-31T00:00:00.000Z',
      lastError: null,
      notificationsDisabled: false,
      dismissedVersion: '0.2.0',
      repositoryUrl: 'https://github.com/daoif/onlymail',
      releasesUrl: 'https://github.com/daoif/onlymail/releases',
      updateGuideUrl: 'https://github.com/daoif/onlymail/blob/master/DOCS/UPDATE.md',
      updateAvailable: true,
    }),
    false,
  )
})
