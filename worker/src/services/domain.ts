import { exec, many, one } from '../lib/db'
import { createProviders } from '../providers/index'
import { AppError } from '../lib/http'
import { DEFAULT_WORKER_NAME } from '../lib/project-defaults'
import type { DnsRecord, EmailRule } from '../providers/types'
import type { AppBindings, DomainRecord } from '../types'
import { findNearestRootDomainName, getManagedSubdomainConstants, planSubdomainProvision } from './domain-reconciliation'

const DEFAULT_MANAGED_SUBDOMAIN_LIMIT = 5

function requireEmailRoutingAuth(env: AppBindings) {
  const authEmail = env.CF_AUTH_EMAIL || env.CF_EMAIL
  if (!authEmail || !env.CF_GLOBAL_API_KEY) {
    throw new AppError(500, '缺少 CF_EMAIL（或旧名字 CF_AUTH_EMAIL）或 CF_GLOBAL_API_KEY，无法执行 Email Routing 操作')
  }
}

async function findDomain(env: AppBindings, name: string) {
  return one<DomainRecord>(env.DB.prepare('SELECT * FROM domains WHERE name = ?1').bind(name.toLowerCase()))
}

async function findRootDomains(env: AppBindings) {
  return many<DomainRecord>(
    env.DB.prepare('SELECT * FROM domains WHERE is_root = 1 ORDER BY length(name) DESC, created_at ASC'),
  )
}

async function resolveRootDomainRecord(env: AppBindings, name: string, explicitRootName?: string) {
  if (explicitRootName) {
    const explicit = await findDomain(env, explicitRootName)
    if (explicit?.is_root === 1) {
      return explicit
    }
    return null
  }

  const roots = await findRootDomains(env)
  const matchedRootName = findNearestRootDomainName(name, roots.map((root) => root.name))
  return roots.find((root) => root.name === matchedRootName) ?? null
}

function normalizeManagedName(value: string) {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

function getManagedSubdomainLimit(env: AppBindings) {
  const raw = env.ONLYMAIL_MANAGED_SUBDOMAIN_LIMIT?.trim()
  if (!raw) {
    return DEFAULT_MANAGED_SUBDOMAIN_LIMIT
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MANAGED_SUBDOMAIN_LIMIT
  }

  return parsed > 0 ? parsed : null
}

function hasManagedRouteMatcher(rule: EmailRule, name: string) {
  const pattern = `*@${normalizeManagedName(name)}`
  return (rule.matchers ?? []).some((matcher) => (
    matcher.type === 'literal'
      && matcher.field === 'to'
      && matcher.value === pattern
  ))
}

function isManagedDnsRecord(record: DnsRecord, name: string) {
  return (
    (record.type === 'MX' || record.type === 'TXT')
      && normalizeManagedName(record.name) === normalizeManagedName(name)
  )
}

async function listManagedSubdomainResources(env: AppBindings, record: Pick<DomainRecord, 'name' | 'cf_zone_id' | 'route_rule_id'>) {
  const providers = createProviders(env)
  const [dnsRecords, emailRules] = await Promise.all([
    providers.dns.listDnsRecords(record.cf_zone_id, { name: record.name }),
    providers.email.listEmailRules(record.cf_zone_id),
  ])

  const exactDnsRecords = dnsRecords.filter((item) => isManagedDnsRecord(item, record.name))
  const routeRule = emailRules.find((rule) => (
    (record.route_rule_id && rule.id === record.route_rule_id)
      || hasManagedRouteMatcher(rule, record.name)
  )) ?? null

  return {
    providers,
    dnsRecords: exactDnsRecords,
    routeRule,
  }
}

async function enforceManagedSubdomainLimit(
  env: AppBindings,
  rootName: string,
  incomingName: string,
) {
  const limit = getManagedSubdomainLimit(env)
  if (limit === null) {
    return
  }

  const existing = (await listDomains(env, { type: 'sub', root: rootName }))
    .filter((record) => record.name !== incomingName)

  while (existing.length >= limit) {
    const oldest = existing.shift()
    if (!oldest) {
      break
    }

    await deleteSubdomain(env, oldest.name)
  }
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
  payload: { rootDomain: string },
) {
  requireEmailRoutingAuth(env)
  const rootDomain = payload.rootDomain.trim().toLowerCase()
  const providers = createProviders(env)
  const zoneId = await providers.dns.resolveZoneId(rootDomain)
  const settings = await providers.email.getEmailRoutingSettings(zoneId)

  if (!settings.enabled) {
    await providers.email.enableEmailRouting(zoneId)
  }

  await providers.email.updateCatchAll(zoneId, DEFAULT_WORKER_NAME)

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

export async function createSubdomain(env: AppBindings, payload: { name: string; rootName?: string }) {
  requireEmailRoutingAuth(env)
  const name = payload.name.trim().toLowerCase()
  const existing = await findDomain(env, name)
  if (existing?.is_root === 1) {
    return existing
  }

  const explicitRootName = payload.rootName?.trim().toLowerCase() ?? existing?.root_name
  const rootRecord = await resolveRootDomainRecord(env, name, explicitRootName)
  if (!rootRecord) {
    throw new AppError(400, '请先初始化根域名，再创建子域名')
  }
  const rootName = rootRecord.name

  if (!existing) {
    await enforceManagedSubdomainLimit(env, rootName, name)
  }

  const providers = createProviders(env)
  const { mxTargets, spfContent } = getManagedSubdomainConstants()
  const existingRecords = await providers.dns.listDnsRecords(rootRecord.cf_zone_id, { name })
  const existingRules = await providers.email.listEmailRules(rootRecord.cf_zone_id)
  const provisionPlan = planSubdomainProvision(name, DEFAULT_WORKER_NAME, existingRecords, existingRules)

  if (provisionPlan.conflictingRouteRuleId) {
    throw new AppError(409, '这个子域名已经有现成的 Email Routing 规则，但目标不是当前 Worker，请先手动清理后再重试')
  }

  const mxIds: string[] = [...provisionPlan.reusableMxRecordIds]
  const createdMxIds: string[] = []
  let txtRecordId: string | null = provisionPlan.txtRecordId
  let createdTxtRecordId: string | null = null
  let routeRuleId: string | null = provisionPlan.routeRuleId
  let createdRouteRuleId: string | null = null

  try {
    for (const target of provisionPlan.mxTargetsToCreate) {
      const record = await providers.dns.createDnsRecord(rootRecord.cf_zone_id, {
        type: 'MX',
        name,
        content: target.content,
        priority: target.priority,
      })
      mxIds.push(record.id)
      createdMxIds.push(record.id)
    }

    if (provisionPlan.needsTxtRecord) {
      const txtRecord = await providers.dns.createDnsRecord(rootRecord.cf_zone_id, {
        type: 'TXT',
        name,
        content: spfContent,
      })
      txtRecordId = txtRecord.id
      createdTxtRecordId = txtRecord.id
    }

    if (provisionPlan.needsRouteRule) {
      const rule = await providers.email.createEmailRule(rootRecord.cf_zone_id, {
        actions: [{ type: 'worker', value: [DEFAULT_WORKER_NAME] }],
        matchers: [{ type: 'literal', field: 'to', value: `*@${name}` }],
        enabled: true,
        name: `${name}-worker-route`,
        priority: 0,
      })
      routeRuleId = rule.id
      createdRouteRuleId = rule.id
    }

    await exec(
      env.DB.prepare(
        `INSERT INTO domains (name, root_name, is_root, routing_enabled, cf_zone_id, mx_record_ids, txt_record_id, route_rule_id)
         VALUES (?1, ?2, 0, 1, ?3, ?4, ?5, ?6)
         ON CONFLICT(name) DO UPDATE SET
           root_name = excluded.root_name,
           routing_enabled = excluded.routing_enabled,
           cf_zone_id = excluded.cf_zone_id,
           mx_record_ids = excluded.mx_record_ids,
           txt_record_id = excluded.txt_record_id,
           route_rule_id = excluded.route_rule_id`,
      ).bind(name, rootName, rootRecord.cf_zone_id, JSON.stringify(mxIds), txtRecordId, routeRuleId),
    )
  } catch (error) {
    await rollbackDomainProvision(env, {
      zoneId: rootRecord.cf_zone_id,
      mxIds: createdMxIds,
      txtRecordId: createdTxtRecordId,
      routeRuleId: createdRouteRuleId,
    })
    throw error
  }

  return (await findDomain(env, name))!
}

export async function deleteSubdomains(env: AppBindings, names: string[]) {
  const normalizedNames = Array.from(new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean)))
  const deleted: string[] = []
  const skippedRoots: string[] = []
  const skippedMissing: string[] = []

  for (const name of normalizedNames) {
    const record = await findDomain(env, name)
    if (!record) {
      skippedMissing.push(name)
      continue
    }

    if (record.is_root === 1) {
      skippedRoots.push(name)
      continue
    }

    await deleteSubdomain(env, name)
    deleted.push(name)
  }

  return {
    deleted,
    skippedRoots,
    skippedMissing,
  }
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

  const resources = await listManagedSubdomainResources(env, record)

  if (resources.routeRule) {
    await resources.providers.email.deleteEmailRule(record.cf_zone_id, resources.routeRule.id)
  }

  for (const dnsRecord of resources.dnsRecords) {
    await resources.providers.dns.deleteDnsRecord(record.cf_zone_id, dnsRecord.id)
  }

  const result = await exec(env.DB.prepare('DELETE FROM domains WHERE name = ?1').bind(name.toLowerCase()))
  return result.meta.changes > 0
}
