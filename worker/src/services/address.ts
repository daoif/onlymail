import type { AppBindings, AddressRecord, PageParams } from '../types'

import { exec, many, one } from '../lib/db'

export type AddressStatus = 'created' | 'occupied' | 'available'

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
  const existing = await findAddressByName(env, normalized)

  if (existing) {
    return {
      status: existing.project === payload.project ? 'occupied' : 'available',
      address: existing,
    } as { status: AddressStatus; address: AddressRecord }
  }

  const domain = getDomainFromAddress(normalized)
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
  const expired = await many<{ name: string }>(
    env.DB.prepare(
      `SELECT name FROM address
       WHERE ttl_hours > 0
       AND datetime(updated_at) <= datetime('now', '-' || ttl_hours || ' hours')`,
    ),
  )

  if (expired.length === 0) {
    return { addressCount: 0, mailCount: 0 }
  }

  const names = expired.map((item) => item.name)
  const placeholders = names.map(() => '?').join(',')
  const mailDelete = await exec(env.DB.prepare(`DELETE FROM raw_mails WHERE address IN (${placeholders})`).bind(...names))
  const addressDelete = await exec(env.DB.prepare(`DELETE FROM address WHERE name IN (${placeholders})`).bind(...names))

  return {
    addressCount: addressDelete.meta.changes,
    mailCount: mailDelete.meta.changes,
  }
}
