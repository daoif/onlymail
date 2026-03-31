import { describe, expect, it } from 'vitest'

import type { VersionUpdateState } from '../types'

import { formatVersionText, shouldShowUpdateBanner } from './update-notice'

function createState(overrides: Partial<VersionUpdateState> = {}): VersionUpdateState {
  return {
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
    ...overrides,
  }
}

describe('update notice helpers', () => {
  it('有新版本且没有关闭时显示横幅', () => {
    expect(shouldShowUpdateBanner(createState())).toBe(true)
  })

  it('当前最新版本已关闭一次时不显示横幅', () => {
    expect(shouldShowUpdateBanner(createState({ dismissedVersion: '0.2.0' }))).toBe(false)
  })

  it('出现更高版本后会重新显示横幅', () => {
    expect(shouldShowUpdateBanner(createState({ dismissedVersion: '0.2.0', latestVersion: '0.3.0' }))).toBe(true)
  })

  it('永久关闭时不显示横幅', () => {
    expect(shouldShowUpdateBanner(createState({ notificationsDisabled: true }))).toBe(false)
  })

  it('格式化版本文案', () => {
    expect(formatVersionText('0.1.0')).toBe('v0.1.0')
    expect(formatVersionText(null)).toBe('—')
  })
})
