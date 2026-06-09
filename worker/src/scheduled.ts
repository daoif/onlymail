import type { AppBindings } from './types'

import { cleanupExpiredAddresses } from './services/address'
import { cleanupExpiredAdminSessions } from './services/admin-session'
import { autoCleanupD1TemporaryData } from './services/d1-admin'
import { checkVersionUpdates } from './services/version-update'

export async function handleScheduled(_controller: ScheduledController, env: AppBindings) {
  const cleanupResult = await cleanupExpiredAddresses(env)
  console.log(`cleanup complete: addresses=${cleanupResult.addressCount}, mails=${cleanupResult.mailCount}`)

  try {
    const autoCleanupResult = await autoCleanupD1TemporaryData(env)
    if (autoCleanupResult.triggered) {
      console.log(
        `d1 auto cleanup complete: addresses=${autoCleanupResult.deletedAddresses}, mails=${autoCleanupResult.deletedMails}, before=${autoCleanupResult.capacityBefore?.usagePercent ?? 0}%, after=${autoCleanupResult.capacityAfter?.usagePercent ?? 0}%`,
      )
    }
  } catch (error) {
    console.error('d1 auto cleanup failed', error)
  }

  await cleanupExpiredAdminSessions(env)

  try {
    const updateState = await checkVersionUpdates(env)
    console.log(
      `update check complete: current=${updateState.currentVersion}, latest=${updateState.latestVersion ?? 'none'}, available=${updateState.updateAvailable}`,
    )
  } catch (error) {
    console.error('update check failed', error)
  }
}
