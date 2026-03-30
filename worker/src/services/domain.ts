import { exec, many, one } from '../lib/db'
import { createProviders } from '../providers/index'
import { AppError } from '../lib/http'
import type { AppBindings, DomainRecord } from '../types'

const MX_TARGETS = [
  { content: 'route1.mx.cloudflare.net', priority: 86 },
  { content: 'route2.mx.cloudflare.net', priority: 23 },
  { content: 'route3.mx.cloudflare.net', priority: 50 },
]

function requireEmailRoutingAuth(env: AppBindings) {
  const authEmail = env.CF_AUTH_EMAIL || env.CF_EMAIL
  if (!authEmail || !env.CF_GLOBAL_API_KEY) {
    throw new AppError(500, '缺少 CF_EMAIL（或旧名字 CF_AUTH_EMAIL）或 CF_GLOBAL_API_KEY，无法执行 Email Routing 操作')
  }
}

async function findDomain(env: AppBindings, name: string) {
  return one<DomainRecord>(env.DB.prepare('SELECT * FROM domains WHERE name = ?1').bind(name.toLowerCase()))
}

export async function listDomains(
  env: AppBindings,
  filters?: { type?: 'root' | 'sub'; root?: string; limit?: number },
) {
  const where: string[] = []
  const bindings: Array<string | number> = []
  let paramIdx = 1

  if (filters?.type === 'root') {
    where.push(`is_root = ?${paramIdx++}`)
    bindings.push(1)
  } else if (filters?.type === 'sub') {
    where.push(`is_root = ?${paramIdx++}`)
    bindings.push(0)
  }

  if (filters?.root) {
    where.push(`root_name = ?${paramIdx++}`)
    bindings.push(filters.root.toLowerCase())
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const limitSql = filters?.limit ? ` LIMIT ?${paramIdx++}` : ''
  const limitBindings = filters?.limit ? [...bindings, filters.limit] : bindings

  return many<DomainRecord>(
    env.DB.prepare(
      `SELECT * FROM domains ${whereSql} ORDER BY is_root DESC, created_at ASC${limitSql}`,
    ).bind(...limitBindings),
  )
}

export async function getDomainDetail(env: AppBindings, name: string) {
  const domain = await findDomain(env, name)
  if (!domain) {
    return null
  }

  const countRow = await one<{ total: number }>(
    env.DB.prepare('SELECT COUNT(*) AS total FROM address WHERE domain = ?1 OR domain LIKE ?2').bind(
      name.toLowerCase(),
      `%.${name.toLowerCase()}`,
    ),
  )

  const projectStats = await many<{ project: string; count: number }>(
    env.DB.prepare(
      `SELECT project, COUNT(*) AS count FROM address
       WHERE domain = ?1 OR domain LIKE ?2
       GROUP BY project ORDER BY count DESC`,
    ).bind(name.toLowerCase(), `%.${name.toLowerCase()}`),
  )

  return {
    ...domain,
    address_count: countRow?.total ?? 0,
    address_count_by_project: projectStats,
  }
}

export async function bootstrapRootDomain(
  env: AppBindings,
  payload: { rootDomain: string; zoneId?: string },
) {
  requireEmailRoutingAuth(env)
  const rootDomain = payload.rootDomain.trim().toLowerCase()
  const providers = createProviders(env)
  const zoneId = await providers.dns.resolveZoneId(rootDomain, payload.zoneId?.trim())
  const settings = await providers.email.getEmailRoutingSettings(zoneId)
  const workerName = env.CF_DEFAULT_WORKER_NAME || 'mails-worker'

  if (!settings.enabled) {
    await providers.email.enableEmailRouting(zoneId)
  }

  await providers.email.updateCatchAll(zoneId, workerName)

  await exec(
    env.DB.prepare(
      `INSERT INTO domains (name, root_name, is_root, routing_enabled, cf_zone_id, mx_record_ids)
       VALUES (?1, ?1, 1, 1, ?2, '[]')
       ON CONFLICT(name) DO UPDATE SET
         routing_enabled = 1,
         cf_zone_id = excluded.cf_zone_id`,
    ).bind(rootDomain, zoneId),
  )

  return (await findDomain(env, rootDomain))!
}

export async function createSubdomain(env: AppBindings, payload: { name: string; rootName?: string; workerName?: string }) {
  requireEmailRoutingAuth(env)
  const name = payload.name.trim().toLowerCase()
  const existing = await findDomain(env, name)
  if (existing) {
    return existing
  }

  const rootName = payload.rootName?.trim().toLowerCase() ?? name.split('.').slice(1).join('.')
  const rootRecord = await findDomain(env, rootName)
  if (!rootRecord || rootRecord.is_root !== 1) {
    throw new AppError(400, '请先初始化根域名，再创建子域名')
  }

  const workerName = payload.workerName?.trim() || env.CF_DEFAULT_WORKER_NAME
  if (!workerName) {
    throw new AppError(500, '缺少 Worker 名称，无法创建 Email Routing 规则')
  }

  const providers = createProviders(env)
  const mxIds: string[] = []
  let txtRecordId: string | null = null
  let routeRuleId: string | null = null

  try {
    for (const target of MX_TARGETS) {
      const record = await providers.dns.createDnsRecord(rootRecord.cf_zone_id, {
        type: 'MX',
        name,
        content: target.content,
        priority: target.priority,
      })
      mxIds.push(record.id)
    }

    const txtRecord = await providers.dns.createDnsRecord(rootRecord.cf_zone_id, {
      type: 'TXT',
      name,
      content: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
    })
    txtRecordId = txtRecord.id

    const rule = await providers.email.createEmailRule(rootRecord.cf_zone_id, {
      actions: [{ type: 'worker', value: [workerName] }],
      matchers: [{ type: 'literal', field: 'to', value: `*@${name}` }],
      enabled: true,
      name: `${name}-worker-route`,
      priority: 0,
    })
    routeRuleId = rule.id

    await exec(
      env.DB.prepare(
        `INSERT INTO domains (name, root_name, is_root, routing_enabled, cf_zone_id, mx_record_ids, txt_record_id, route_rule_id)
         VALUES (?1, ?2, 0, 1, ?3, ?4, ?5, ?6)`,
      ).bind(name, rootName, rootRecord.cf_zone_id, JSON.stringify(mxIds), txtRecordId, routeRuleId),
    )
  } catch (error) {
    await rollbackDomainProvision(env, {
      zoneId: rootRecord.cf_zone_id,
      mxIds,
      txtRecordId,
      routeRuleId,
    })
    throw error
  }

  return (await findDomain(env, name))!
}

async function rollbackDomainProvision(
  env: AppBindings,
  resources: { zoneId: string; mxIds: string[]; txtRecordId: string | null; routeRuleId: string | null },
) {
  const providers = createProviders(env)
  const actions: Promise<unknown>[] = []

  if (resources.routeRuleId) {
    actions.push(providers.email.deleteEmailRule(resources.zoneId, resources.routeRuleId).catch(() => null))
  }

  if (resources.txtRecordId) {
    actions.push(providers.dns.deleteDnsRecord(resources.zoneId, resources.txtRecordId).catch(() => null))
  }

  for (const recordId of resources.mxIds) {
    actions.push(providers.dns.deleteDnsRecord(resources.zoneId, recordId).catch(() => null))
  }

  await Promise.all(actions)
}

export async function deleteSubdomain(env: AppBindings, name: string) {
  requireEmailRoutingAuth(env)
  const record = await findDomain(env, name)
  if (!record) {
    return false
  }

  if (record.is_root === 1) {
    throw new AppError(400, '根域名不能在这里删除')
  }

  const providers = createProviders(env)
  const mxIds = JSON.parse(record.mx_record_ids || '[]') as string[]

  if (record.route_rule_id) {
    await providers.email.deleteEmailRule(record.cf_zone_id, record.route_rule_id)
  }

  if (record.txt_record_id) {
    await providers.dns.deleteDnsRecord(record.cf_zone_id, record.txt_record_id)
  }

  for (const recordId of mxIds) {
    await providers.dns.deleteDnsRecord(record.cf_zone_id, recordId)
  }

  const result = await exec(env.DB.prepare('DELETE FROM domains WHERE name = ?1').bind(name.toLowerCase()))
  return result.meta.changes > 0
}
