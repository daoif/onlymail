import type { AppBindings, AddressRecord, PageParams } from '../types'

import { exec, many, one } from '../lib/db'
import { AppError } from '../lib/http'
import { getDomainReadyStatus } from './domain'

export type AddressStatus = 'created' | 'occupied' | 'available'

const EXPIRED_ADDRESS_CLEANUP_BATCH_SIZE = 500

function normalizeAddress(address: string) {
  return address.trim().toLowerCase()
}

function getDomainFromAddress(address: string) {
  return address.split('@')[1] ?? ''
}

export async function findAddressByName(env: AppBindings, address: string) {
  return one<AddressRecord>(env.DB.prepare('SELECT * FROM address WHERE name = ?1').bind(normalizeAddress(address)))
}

export async function createOrInspectAddress(env: AppBindings, payload: { address: string; project: string; ttlHours: number }) {
  const normalized = normalizeAddress(payload.address)
  const domain = getDomainFromAddress(normalized)
  const domainReady = await getDomainReadyStatus(env, domain)
  if (!domainReady.ready) {
    throw new AppError(400, 'domain_not_ready', {
      domain,
      reason: domainReady.reason,
    })
  }

  const existing = await findAddressByName(env, normalized)

  if (existing) {
    return {
      status: existing.project === payload.project ? 'occupied' : 'available',
      address: existing,
    } as { status: AddressStatus; address: AddressRecord }
  }

  await exec(
    env.DB.prepare(
      `INSERT INTO address (name, domain, project, ttl_hours)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(normalized, domain, payload.project, payload.ttlHours),
  )

  const created = await findAddressByName(env, normalized)
  return {
    status: 'created' as const,
    address: created!,
  }
}

export async function listAddresses(
  env: AppBindings,
  pageParams: PageParams,
  filters: { domain?: string; project?: string },
) {
  const where: string[] = []
  const bindings: Array<string | number> = []

  if (filters.domain) {
    where.push('a.domain = ?')
    bindings.push(filters.domain)
  }

  if (filters.project) {
    where.push('a.project = ?')
    bindings.push(filters.project)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const listBindings = [...bindings, pageParams.size, pageParams.offset]

  const items = await many<AddressRecord>(
    env.DB.prepare(
      `SELECT a.*, COUNT(m.id) AS mail_count
       FROM address a
       LEFT JOIN raw_mails m ON m.address = a.name
       ${whereSql}
       GROUP BY a.id
       ORDER BY a.updated_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(...listBindings),
  )

  const countRow = await one<{ total: number }>(
    env.DB.prepare(`SELECT COUNT(*) AS total FROM address a ${whereSql}`).bind(...bindings),
  )

  return {
    items,
    total: countRow?.total ?? 0,
  }
}

export async function deleteAddress(env: AppBindings, address: string) {
  const normalized = normalizeAddress(address)
  await exec(env.DB.prepare('DELETE FROM raw_mails WHERE address = ?1').bind(normalized))
  const result = await exec(env.DB.prepare('DELETE FROM address WHERE name = ?1').bind(normalized))
  return result.meta.changes > 0
}

export async function touchAddress(env: AppBindings, address: string) {
  await exec(
    env.DB.prepare(
      `UPDATE address
       SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE name = ?1`,
    ).bind(normalizeAddress(address)),
  )
}

export async function cleanupExpiredAddresses(env: AppBindings) {
  const expiredAddressSubquery = `SELECT name FROM address
                                  WHERE ttl_hours > 0
                                  AND datetime(updated_at) <= datetime('now', '-' || ttl_hours || ' hours')
                                  ORDER BY updated_at ASC, id ASC
                                  LIMIT ?1`
  let addressCount = 0
  let mailCount = 0
  let batchCount = 0

  while (true) {
    const [mailDelete, addressDelete] = await env.DB.batch([
      env.DB.prepare(`DELETE FROM raw_mails WHERE address IN (${expiredAddressSubquery})`).bind(EXPIRED_ADDRESS_CLEANUP_BATCH_SIZE),
      env.DB.prepare(`DELETE FROM address WHERE name IN (${expiredAddressSubquery})`).bind(EXPIRED_ADDRESS_CLEANUP_BATCH_SIZE),
    ])

    mailCount += mailDelete.meta.changes
    addressCount += addressDelete.meta.changes

    if (addressDelete.meta.changes === 0) {
      break
    }

    batchCount += 1
  }

  return {
    addressCount,
    mailCount,
    batchCount,
  }
}
