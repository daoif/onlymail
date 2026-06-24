import type { AppBindings } from './types'

import { cleanupExpiredAddresses } from './services/address'
import { cleanupExpiredAdminSessions } from './services/admin-session'
import { autoCleanupD1TemporaryData } from './services/d1-admin'
import { checkVersionUpdates } from './services/version-update'

function logScheduled(level: 'info' | 'warn' | 'error', payload: Record<string, unknown>) {
  console[level](JSON.stringify({
    event: 'onlymail.scheduled',
    ...payload,
  }))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function handleScheduled(controller: ScheduledController, env: AppBindings) {
  const startedAt = Date.now()
  logScheduled('info', {
    step: 'start',
    cron: controller.cron,
    scheduled_time: controller.scheduledTime,
  })

  try {
    const stepStartedAt = Date.now()
    const cleanupResult = await cleanupExpiredAddresses(env)
    logScheduled('info', {
      step: 'ttl_cleanup',
      status: 'ok',
      duration_ms: Date.now() - stepStartedAt,
      deleted_addresses: cleanupResult.addressCount,
      deleted_mails: cleanupResult.mailCount,
      executed_batches: cleanupResult.batchCount,
    })
  } catch (error) {
    logScheduled('error', {
      step: 'ttl_cleanup',
      status: 'error',
      error_message: errorMessage(error),
    })
  }

  try {
    const stepStartedAt = Date.now()
    const autoCleanupResult = await autoCleanupD1TemporaryData(env)
    logScheduled('info', {
      step: 'd1_auto_cleanup',
      status: 'ok',
      duration_ms: Date.now() - stepStartedAt,
      enabled: autoCleanupResult.settings.enabled,
      trigger_usage_percent: autoCleanupResult.settings.triggerUsagePercent,
      keep_temporary_addresses: autoCleanupResult.settings.keepTemporaryAddresses,
      triggered: autoCleanupResult.triggered,
      reason: autoCleanupResult.reason,
      capacity_before_bytes: autoCleanupResult.capacityBefore?.sizeBytes ?? null,
      capacity_before_percent: autoCleanupResult.capacityBefore?.usagePercent ?? null,
      capacity_after_bytes: autoCleanupResult.capacityAfter?.sizeBytes ?? null,
      capacity_after_percent: autoCleanupResult.capacityAfter?.usagePercent ?? null,
      deleted_addresses: autoCleanupResult.deletedAddresses,
      deleted_mails: autoCleanupResult.deletedMails,
    })
  } catch (error) {
    logScheduled('error', {
      step: 'd1_auto_cleanup',
      status: 'error',
      error_message: errorMessage(error),
    })
  }

  try {
    const stepStartedAt = Date.now()
    await cleanupExpiredAdminSessions(env)
    logScheduled('info', {
      step: 'admin_session_cleanup',
      status: 'ok',
      duration_ms: Date.now() - stepStartedAt,
    })
  } catch (error) {
    logScheduled('error', {
      step: 'admin_session_cleanup',
      status: 'error',
      error_message: errorMessage(error),
    })
  }

  try {
    const stepStartedAt = Date.now()
    const updateState = await checkVersionUpdates(env)
    logScheduled('info', {
      step: 'version_check',
      status: 'ok',
      duration_ms: Date.now() - stepStartedAt,
      current_version: updateState.currentVersion,
      latest_version: updateState.latestVersion,
      update_available: updateState.updateAvailable,
      last_error: updateState.lastError,
    })
  } catch (error) {
    logScheduled('error', {
      step: 'version_check',
      status: 'error',
      error_message: errorMessage(error),
    })
  }

  logScheduled('info', {
    step: 'complete',
    status: 'ok',
    duration_ms: Date.now() - startedAt,
  })
}
