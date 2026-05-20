import type { AppBindings, D1CapacityStats, D1CleanupResult, D1CleanupScope, D1CleanupTarget } from '../types'

const D1_MAX_SIZE_BYTES = 500_000_000

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
