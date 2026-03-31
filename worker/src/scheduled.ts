import type { AppBindings } from './types'

import { cleanupExpiredAddresses } from './services/address'
import { checkVersionUpdates } from './services/version-update'

export async function handleScheduled(_controller: ScheduledController, env: AppBindings) {
  const cleanupResult = await cleanupExpiredAddresses(env)
  console.log(`cleanup complete: addresses=${cleanupResult.addressCount}, mails=${cleanupResult.mailCount}`)

  try {
    const updateState = await checkVersionUpdates(env)
    console.log(
      `update check complete: current=${updateState.currentVersion}, latest=${updateState.latestVersion ?? 'none'}, available=${updateState.updateAvailable}`,
    )
  } catch (error) {
    console.error('update check failed', error)
  }
}
