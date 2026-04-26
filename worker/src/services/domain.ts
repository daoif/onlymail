import { exec, many, one } from '../lib/db'
import { createProviders } from '../providers/index'
import { AppError } from '../lib/http'
import { DEFAULT_WORKER_NAME } from '../lib/project-defaults'
import type { DnsRecord, DnsRecordInventory, EmailRule } from '../providers/types'
import type { AppBindings, DomainRecord, DomainType, SubdomainDnsMode, SubdomainType } from '../types'
import { findNearestRootDomainName, getManagedSubdomainConstants, planSubdomainProvision } from './domain-reconciliation'
import { getSubdomainDnsMode, getSubdomainRotationLimit } from './settings'

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

function normalizeSubdomainType(value?: string | null): SubdomainType {
  return value === 'temporary' ? 'temporary' : 'permanent'
}

function getDomainType(record: Pick<DomainRecord, 'is_root' | 'subdomain_type'>): DomainType {
  if (record.is_root === 1) {
    return 'root'
  }

  return normalizeSubdomainType(record.subdomain_type)
}

function parseStoredMxRecordIds(value: string) {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    }
  } catch {
    return []
  }

  return []
}

function getManagedDnsCount(record: DomainRecord, dnsUnitSize: number) {
  if (record.is_root === 1) {
    return 0
  }

  const mxCount = parseStoredMxRecordIds(record.mx_record_ids).length
  const txtCount = record.txt_record_id ? 1 : 0
  const storedCount = mxCount + txtCount

  return storedCount > 0 ? storedCount : dnsUnitSize
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

function getLiveManagedDnsCount(records: DnsRecord[] | undefined, subdomainNames: Set<string>, fallbackCount: number) {
  if (!records) {
    return fallbackCount
  }

  return records.filter((record) => (
    (record.type === 'MX' || record.type === 'TXT')
      && subdomainNames.has(normalizeManagedName(record.name))
  )).length
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

async function enforceTemporarySubdomainLimit(
  env: AppBindings,
  rootName: string,
  incomingName: string,
) {
  const limit = await getSubdomainRotationLimit(env)
  const existing = (await listDomains(env, { type: 'sub', root: rootName, subdomainType: 'temporary' }))
    .filter((record) => record.name !== incomingName)

  while (existing.length >= limit) {
    const oldest = existing.shift()
    if (!oldest) {
      break
    }

    await deleteSubdomain(env, oldest.name)
  }
}

async function enrichRootDomainStats(env: AppBindings, rows: DomainRecord[]) {
  const dnsMode = await getSubdomainDnsMode(env)
  const dnsUnitSize = getDomainDnsUnitSize(dnsMode)
  const rootNames = Array.from(new Set(rows.filter((item) => item.is_root === 1).map((item) => item.name)))
  if (rootNames.length === 0) {
    return rows.map((row) => ({
      ...row,
      subdomain_type: getDomainType(row),
      managed_dns_count: getManagedDnsCount(row, dnsUnitSize),
      dns_records_per_subdomain: dnsUnitSize,
    }))
  }

  const placeholders = rootNames.map((_, index) => `?${index + 1}`).join(', ')
  const subdomains = await many<DomainRecord>(
    env.DB.prepare(
      `SELECT * FROM domains WHERE is_root = 0 AND root_name IN (${placeholders}) ORDER BY created_at ASC`,
    ).bind(...rootNames),
  )
  const rotationLimit = await getSubdomainRotationLimit(env)
  const providers = createProviders(env)
  const stats = new Map<string, {
    storedManagedDnsCount: number
    permanentCount: number
    temporaryCount: number
    subdomainNames: Set<string>
  }>()
  const inventoryByRootName = new Map<string, DnsRecordInventory>()

  for (const rootName of rootNames) {
    stats.set(rootName, {
      storedManagedDnsCount: 0,
      permanentCount: 0,
      temporaryCount: 0,
      subdomainNames: new Set(),
    })
  }

  for (const subdomain of subdomains) {
    const rootStats = stats.get(subdomain.root_name)
    if (!rootStats) {
      continue
    }

    rootStats.storedManagedDnsCount += getManagedDnsCount(subdomain, dnsUnitSize)
    rootStats.subdomainNames.add(normalizeManagedName(subdomain.name))
    if (getDomainType(subdomain) === 'temporary') {
      rootStats.temporaryCount += 1
    } else {
      rootStats.permanentCount += 1
    }
  }

  await Promise.all(rows.filter((row) => row.is_root === 1).map(async (row) => {
    try {
      inventoryByRootName.set(row.name, await providers.dns.getDnsRecordInventory(row.cf_zone_id))
    } catch {
      // DNS 配额统计是展示用的实时信息；Cloudflare 凭据缺失或临时失败时，不阻断域名列表。
    }
  }))

  return rows.map((row) => {
    if (row.is_root !== 1) {
      return {
        ...row,
        subdomain_type: getDomainType(row),
        managed_dns_count: getManagedDnsCount(row, dnsUnitSize),
        dns_records_per_subdomain: dnsUnitSize,
      }
    }

    const rootStats = stats.get(row.name) ?? {
      storedManagedDnsCount: 0,
      permanentCount: 0,
      temporaryCount: 0,
      subdomainNames: new Set<string>(),
    }
    const inventory = inventoryByRootName.get(row.name)
    const liveManagedDnsCount = getLiveManagedDnsCount(
      inventory?.records,
      rootStats.subdomainNames,
      rootStats.storedManagedDnsCount,
    )

    return {
      ...row,
      subdomain_type: 'root' as const,
      managed_dns_count: liveManagedDnsCount,
      remaining_dns_count: inventory?.remaining,
      manageable_dns_count: inventory?.limit,
      cf_dns_record_count: inventory?.totalCount,
      cf_dns_record_limit: inventory?.limit,
      dns_records_per_subdomain: dnsUnitSize,
      permanent_subdomain_count: rootStats.permanentCount,
      temporary_subdomain_count: rootStats.temporaryCount,
      subdomain_rotation_limit: rotationLimit,
    }
  })
}

export async function listDomains(
  env: AppBindings,
  filters?: { type?: 'root' | 'sub'; root?: string; subdomainType?: SubdomainType; limit?: number },
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

  if (filters?.subdomainType) {
    where.push(`subdomain_type = ?${paramIdx++}`)
    bindings.push(filters.subdomainType)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const limitSql = filters?.limit ? ` LIMIT ?${paramIdx++}` : ''
  const limitBindings = filters?.limit ? [...bindings, filters.limit] : bindings

  const rows = await many<DomainRecord>(
    env.DB.prepare(
      `SELECT * FROM domains ${whereSql} ORDER BY is_root DESC, created_at ASC${limitSql}`,
    ).bind(...limitBindings),
  )

  return enrichRootDomainStats(env, rows)
}

export async function getDomainDetail(env: AppBindings, name: string) {
  const rawDomain = await findDomain(env, name)
  const domain = rawDomain ? (await enrichRootDomainStats(env, [rawDomain]))[0] : null
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
      `INSERT INTO domains (name, root_name, is_root, subdomain_type, routing_enabled, cf_zone_id, mx_record_ids)
       VALUES (?1, ?1, 1, 'root', 1, ?2, '[]')
       ON CONFLICT(name) DO UPDATE SET
         routing_enabled = 1,
         cf_zone_id = excluded.cf_zone_id,
         subdomain_type = 'root'`,
    ).bind(rootDomain, zoneId),
  )

  return (await findDomain(env, rootDomain))!
}

export async function createSubdomain(env: AppBindings, payload: { name: string; rootName?: string; subdomainType?: SubdomainType }) {
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
  const subdomainType = existing ? normalizeSubdomainType(existing.subdomain_type) : normalizeSubdomainType(payload.subdomainType)

  if (!existing && subdomainType === 'temporary') {
    await enforceTemporarySubdomainLimit(env, rootName, name)
  }

  const providers = createProviders(env)
  const dnsMode = await getSubdomainDnsMode(env)
  const { spfContent } = getManagedSubdomainConstants(dnsMode)
  const existingRecords = await providers.dns.listDnsRecords(rootRecord.cf_zone_id, { name })
  const existingRules = await providers.email.listEmailRules(rootRecord.cf_zone_id)
  const provisionPlan = planSubdomainProvision(name, DEFAULT_WORKER_NAME, existingRecords, existingRules, dnsMode)

  if (provisionPlan.conflictingRouteRuleId) {
    throw new AppError(409, '这个子域名已经有现成的 Email Routing 规则，但目标不是当前 Worker，请先手动清理后再重试')
  }

  const dnsRecordsToCreate = provisionPlan.mxTargetsToCreate.length + (provisionPlan.needsTxtRecord && spfContent ? 1 : 0)
  if (dnsRecordsToCreate > 0) {
    const inventory = await providers.dns.getDnsRecordInventory(rootRecord.cf_zone_id)
    if (inventory.remaining < dnsRecordsToCreate) {
      throw new AppError(
        400,
        `Cloudflare DNS 剩余 ${inventory.remaining} 条，不足以创建 ${name} 需要的 ${dnsRecordsToCreate} 条记录；请删除无用 DNS 记录或切换 DNS 模式后重试`,
      )
    }
  }

  const existingMxIds = existingRecords
    .filter((record) => record.type === 'MX' && isManagedDnsRecord(record, name))
    .map((record) => record.id)
  const mxIds: string[] = Array.from(new Set([...existingMxIds, ...provisionPlan.reusableMxRecordIds]))
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

    if (provisionPlan.needsTxtRecord && spfContent) {
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
        `INSERT INTO domains (name, root_name, is_root, subdomain_type, routing_enabled, cf_zone_id, mx_record_ids, txt_record_id, route_rule_id)
         VALUES (?1, ?2, 0, ?3, 1, ?4, ?5, ?6, ?7)
         ON CONFLICT(name) DO UPDATE SET
           root_name = excluded.root_name,
           subdomain_type = excluded.subdomain_type,
           routing_enabled = excluded.routing_enabled,
           cf_zone_id = excluded.cf_zone_id,
           mx_record_ids = excluded.mx_record_ids,
           txt_record_id = excluded.txt_record_id,
           route_rule_id = excluded.route_rule_id`,
      ).bind(name, rootName, subdomainType, rootRecord.cf_zone_id, JSON.stringify(mxIds), txtRecordId, routeRuleId),
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

export function getDomainDnsUnitSize(dnsMode: SubdomainDnsMode = 'compatible') {
  return getManagedSubdomainConstants(dnsMode).dnsRecordsPerSubdomain
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
