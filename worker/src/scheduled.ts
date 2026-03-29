import type { AppBindings } from './types'

import { cleanupExpiredAddresses } from './services/address'

export async function handleScheduled(_controller: ScheduledController, env: AppBindings) {
  const result = await cleanupExpiredAddresses(env)
  console.log(`cleanup complete: addresses=${result.addressCount}, mails=${result.mailCount}`)
}
