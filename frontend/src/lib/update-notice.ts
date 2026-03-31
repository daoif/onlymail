import type { VersionUpdateState } from '../types'

export function shouldShowUpdateBanner(state: VersionUpdateState | null | undefined) {
  if (!state || !state.updateAvailable || !state.latestVersion || state.notificationsDisabled) {
    return false
  }

  return state.dismissedVersion !== state.latestVersion
}

export function formatVersionText(value: string | null | undefined) {
  return value ? `v${value}` : '—'
}
