import type { AppBindings } from '../types'

import * as appReleaseModule from '../../../shared/app-release'
import * as versionUtilsModule from '../../../shared/version'
import { getSettingValue, setSettingValue } from './settings'

function unwrapTsxDefault<T extends object>(moduleValue: T): T {
  return ('default' in moduleValue && moduleValue.default && typeof moduleValue.default === 'object'
    ? moduleValue.default
    : moduleValue) as T
}

const appRelease = unwrapTsxDefault(appReleaseModule)
const versionUtils = unwrapTsxDefault(versionUtilsModule)
const { APP_RELEASES_API_URL, APP_RELEASES_URL, APP_REPOSITORY_URL, APP_UPDATE_GUIDE_URL, APP_VERSION } = appRelease
const { compareVersions, normalizeVersion } = versionUtils
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

type GithubReleasePayload = {
  html_url?: string
  published_at?: string
  prerelease?: boolean
  draft?: boolean
  tag_name?: string
}

export type VersionUpdateState = {
  currentVersion: string
  latestVersion: string | null
  latestTag: string | null
  latestReleaseUrl: string | null
  latestPublishedAt: string | null
  lastCheckedAt: string | null
  lastError: string | null
  notificationsDisabled: boolean
  dismissedVersion: string | null
  repositoryUrl: string
  releasesUrl: string
  updateGuideUrl: string
  updateAvailable: boolean
}

function toBoolean(value: string | null | undefined) {
  return value === 'true'
}

function shouldThrottle(lastCheckedAt: string | null, force: boolean) {
  if (force || !lastCheckedAt) {
    return false
  }

  const timestamp = Date.parse(lastCheckedAt)
  if (Number.isNaN(timestamp)) {
    return false
  }

  return Date.now() - timestamp < UPDATE_CHECK_INTERVAL_MS
}

function toState(input: {
  latestVersion: string | null
  latestTag: string | null
  latestReleaseUrl: string | null
  latestPublishedAt: string | null
  lastCheckedAt: string | null
  lastError: string | null
  notificationsDisabled: boolean
  dismissedVersion: string | null
}): VersionUpdateState {
  const latestVersion = normalizeVersion(input.latestVersion)
  const currentVersion = APP_VERSION
  const updateAvailable = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false

  return {
    currentVersion,
    latestVersion,
    latestTag: input.latestTag,
    latestReleaseUrl: input.latestReleaseUrl,
    latestPublishedAt: input.latestPublishedAt,
    lastCheckedAt: input.lastCheckedAt,
    lastError: input.lastError,
    notificationsDisabled: input.notificationsDisabled,
    dismissedVersion: normalizeVersion(input.dismissedVersion),
    repositoryUrl: APP_REPOSITORY_URL,
    releasesUrl: APP_RELEASES_URL,
    updateGuideUrl: APP_UPDATE_GUIDE_URL,
    updateAvailable,
  }
}

async function readStoredState(env: AppBindings) {
  const [
    latestVersionRow,
    latestTagRow,
    latestReleaseUrlRow,
    latestPublishedAtRow,
    lastCheckedAtRow,
    lastErrorRow,
    notificationsDisabledRow,
    dismissedVersionRow,
  ] = await Promise.all([
    getSettingValue(env, 'update_latest_version'),
    getSettingValue(env, 'update_latest_tag'),
    getSettingValue(env, 'update_latest_release_url'),
    getSettingValue(env, 'update_latest_published_at'),
    getSettingValue(env, 'update_last_checked_at'),
    getSettingValue(env, 'update_last_error'),
    getSettingValue(env, 'update_notifications_disabled'),
    getSettingValue(env, 'update_dismissed_version'),
  ])

  return {
    latestVersion: latestVersionRow?.value ?? null,
    latestTag: latestTagRow?.value ?? null,
    latestReleaseUrl: latestReleaseUrlRow?.value ?? null,
    latestPublishedAt: latestPublishedAtRow?.value ?? null,
    lastCheckedAt: lastCheckedAtRow?.value ?? null,
    lastError: lastErrorRow?.value ?? null,
    notificationsDisabled: toBoolean(notificationsDisabledRow?.value),
    dismissedVersion: dismissedVersionRow?.value ?? null,
  }
}

async function writeCheckResult(
  env: AppBindings,
  payload: {
    latestVersion: string | null
    latestTag: string | null
    latestReleaseUrl: string | null
    latestPublishedAt: string | null
    lastCheckedAt: string
    lastError: string | null
  },
) {
  await Promise.all([
    setSettingValue(env, 'update_latest_version', payload.latestVersion ?? ''),
    setSettingValue(env, 'update_latest_tag', payload.latestTag ?? ''),
    setSettingValue(env, 'update_latest_release_url', payload.latestReleaseUrl ?? ''),
    setSettingValue(env, 'update_latest_published_at', payload.latestPublishedAt ?? ''),
    setSettingValue(env, 'update_last_checked_at', payload.lastCheckedAt),
    setSettingValue(env, 'update_last_error', payload.lastError ?? ''),
  ])
}

async function fetchLatestRelease() {
  const response = await fetch(APP_RELEASES_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `OnlyMail/${APP_VERSION}`,
    },
  })

  if (response.status === 404) {
    return {
      latestVersion: null,
      latestTag: null,
      latestReleaseUrl: null,
      latestPublishedAt: null,
    }
  }

  if (!response.ok) {
    throw new Error(`GitHub Release 检查失败：${response.status}`)
  }

  const payload = await response.json() as GithubReleasePayload
  if (payload.draft || payload.prerelease) {
    return {
      latestVersion: null,
      latestTag: null,
      latestReleaseUrl: null,
      latestPublishedAt: null,
    }
  }

  const latestVersion = normalizeVersion(payload.tag_name)
  if (!latestVersion) {
    throw new Error('GitHub Release tag 格式无效')
  }

  return {
    latestVersion,
    latestTag: payload.tag_name ?? `v${latestVersion}`,
    latestReleaseUrl: payload.html_url ?? null,
    latestPublishedAt: payload.published_at ?? null,
  }
}

export function shouldShowUpdateBanner(state: VersionUpdateState) {
  if (!state.updateAvailable || state.notificationsDisabled || !state.latestVersion) {
    return false
  }

  return state.dismissedVersion !== state.latestVersion
}

export async function getVersionUpdateState(env: AppBindings) {
  return toState(await readStoredState(env))
}

export async function checkVersionUpdates(env: AppBindings, options?: { force?: boolean }) {
  const force = options?.force === true
  const stored = await readStoredState(env)

  if (shouldThrottle(stored.lastCheckedAt, force)) {
    return toState(stored)
  }

  const checkedAt = new Date().toISOString()

  try {
    const release = await fetchLatestRelease()
    await writeCheckResult(env, {
      ...release,
      lastCheckedAt: checkedAt,
      lastError: null,
    })

    return toState({
      ...stored,
      ...release,
      lastCheckedAt: checkedAt,
      lastError: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub Release 检查失败'
    await writeCheckResult(env, {
      latestVersion: stored.latestVersion,
      latestTag: stored.latestTag,
      latestReleaseUrl: stored.latestReleaseUrl,
      latestPublishedAt: stored.latestPublishedAt,
      lastCheckedAt: checkedAt,
      lastError: message,
    })

    return toState({
      ...stored,
      lastCheckedAt: checkedAt,
      lastError: message,
    })
  }
}

export async function dismissUpdateNoticeOnce(env: AppBindings, version: string) {
  const normalized = normalizeVersion(version)
  if (!normalized) {
    throw new Error('无效的版本号')
  }

  await setSettingValue(env, 'update_dismissed_version', normalized)
  const state = await readStoredState(env)
  return toState({
    ...state,
    dismissedVersion: normalized,
  })
}

export async function setUpdateNotificationsDisabled(env: AppBindings, disabled: boolean) {
  await setSettingValue(env, 'update_notifications_disabled', disabled ? 'true' : 'false')
  const state = await readStoredState(env)
  return toState({
    ...state,
    notificationsDisabled: disabled,
  })
}
