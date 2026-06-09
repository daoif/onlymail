import type { AppBindings, D1AutoCleanupRunResult, D1CapacityStats, D1CleanupResult, D1CleanupScope, D1CleanupTarget } from '../types'

import { getD1AutoCleanupSettings } from './settings'

const D1_MAX_SIZE_BYTES = 500_000_000
const D1_AUTO_CLEANUP_BATCH_SIZE = 1_000

function formatMegabytes(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} MB`
}

function buildCapacityStats(sizeBytes: number): D1CapacityStats {
  const remainingBytes = Math.max(D1_MAX_SIZE_BYTES - sizeBytes, 0)
  const usagePercent = Number(Math.min(sizeBytes / D1_MAX_SIZE_BYTES * 100, 100).toFixed(1))

  return {
    sizeBytes,
    sizeLabel: formatMegabytes(sizeBytes),
    limitBytes: D1_MAX_SIZE_BYTES,
    limitLabel: formatMegabytes(D1_MAX_SIZE_BYTES),
    remainingBytes,
    remainingLabel: formatMegabytes(remainingBytes),
    usagePercent,
    status: sizeBytes >= D1_MAX_SIZE_BYTES ? 'danger' : usagePercent >= 90 ? 'warning' : 'normal',
  }
}

function getTargetCondition(target: D1CleanupTarget) {
  return target === 'temporary' ? 'ttl_hours > 0' : 'ttl_hours = 0'
}

async function getCurrentSizeBytes(env: AppBindings) {
  const result = await env.DB.prepare('SELECT 1 AS ok').all<{ ok: number }>()
  return result.meta.size_after ?? 0
}

export async function getD1Capacity(env: AppBindings) {
  return buildCapacityStats(await getCurrentSizeBytes(env))
}

export async function cleanupD1Data(env: AppBindings, scope: D1CleanupScope, target: D1CleanupTarget): Promise<D1CleanupResult> {
  const condition = getTargetCondition(target)
  const statements = [
    env.DB.prepare(
      `DELETE FROM raw_mails
       WHERE address IN (
         SELECT name FROM address WHERE ${condition}
       )`,
    ),
  ]

  if (scope === 'addresses') {
    statements.push(
      env.DB.prepare(
        `DELETE FROM address
         WHERE ${condition}`,
      ),
    )
  }

  const [mailResult, addressResult] = await env.DB.batch(statements)

  return {
    scope,
    target,
    deletedMails: mailResult.meta.changes,
    deletedAddresses: addressResult?.meta.changes ?? 0,
    capacity: await getD1Capacity(env),
  }
}

function oldTemporaryAddressSubquery() {
  return `SELECT name FROM address
          WHERE ttl_hours > 0
          AND name NOT IN (
            SELECT name FROM address
            WHERE ttl_hours > 0
            ORDER BY updated_at DESC, id DESC
            LIMIT ?1
          )
          ORDER BY updated_at ASC, id ASC
          LIMIT ?2`
}

async function deleteOldTemporaryAddressBatch(env: AppBindings, keepCount: number) {
  const oldAddressSubquery = oldTemporaryAddressSubquery()
  const [mailResult, addressResult] = await env.DB.batch([
    env.DB.prepare(`DELETE FROM raw_mails WHERE address IN (${oldAddressSubquery})`).bind(keepCount, D1_AUTO_CLEANUP_BATCH_SIZE),
    env.DB.prepare(`DELETE FROM address WHERE name IN (${oldAddressSubquery})`).bind(keepCount, D1_AUTO_CLEANUP_BATCH_SIZE),
  ])

  return {
    deletedMails: mailResult.meta.changes,
    deletedAddresses: addressResult.meta.changes,
  }
}

async function pruneOldTemporaryAddresses(env: AppBindings, keepCount: number) {
  let deletedMails = 0
  let deletedAddresses = 0

  while (true) {
    const result = await deleteOldTemporaryAddressBatch(env, keepCount)
    deletedMails += result.deletedMails
    deletedAddresses += result.deletedAddresses
    if (result.deletedAddresses === 0) {
      break
    }
  }

  return {
    deletedMails,
    deletedAddresses,
  }
}

export async function autoCleanupD1TemporaryData(env: AppBindings): Promise<D1AutoCleanupRunResult> {
  const settings = await getD1AutoCleanupSettings(env)

  if (!settings.enabled) {
    return {
      settings,
      triggered: false,
      reason: 'disabled',
      deletedMails: 0,
      deletedAddresses: 0,
      capacityBefore: null,
      capacityAfter: null,
    }
  }

  const capacityBefore = await getD1Capacity(env)
  if (capacityBefore.usagePercent < settings.triggerUsagePercent) {
    return {
      settings,
      triggered: false,
      reason: 'below_threshold',
      deletedMails: 0,
      deletedAddresses: 0,
      capacityBefore,
      capacityAfter: null,
    }
  }

  const cleanupResult = await pruneOldTemporaryAddresses(env, settings.keepTemporaryAddresses)

  return {
    settings,
    triggered: true,
    reason: 'completed',
    deletedMails: cleanupResult.deletedMails,
    deletedAddresses: cleanupResult.deletedAddresses,
    capacityBefore,
    capacityAfter: await getD1Capacity(env),
  }
}
