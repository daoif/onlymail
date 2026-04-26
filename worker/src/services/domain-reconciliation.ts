import type { DnsRecord, EmailRule } from '../providers/types'
import type { SubdomainDnsMode } from '../types'

const MX_TARGETS = [
  { content: 'route1.mx.cloudflare.net', priority: 86 },
  { content: 'route2.mx.cloudflare.net', priority: 23 },
  { content: 'route3.mx.cloudflare.net', priority: 50 },
] as const

const SPF_CONTENT = 'v=spf1 include:_spf.mx.cloudflare.net ~all'

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\.+$/, '')
}

function normalizeRecordContent(value: string) {
  return value.trim().toLowerCase().replace(/\.+$/, '').replace(/^"|"$/g, '')
}

function getMxTargets(dnsMode: SubdomainDnsMode) {
  return dnsMode === 'minimal' ? [MX_TARGETS[0]] : [...MX_TARGETS]
}

export function findNearestRootDomainName(name: string, rootNames: string[]) {
  const normalizedName = normalizeName(name)
  const normalizedRoots = Array.from(new Set(rootNames.map(normalizeName))).sort((left, right) => right.length - left.length)
  return normalizedRoots.find((rootName) => (
    normalizedName === rootName || normalizedName.endsWith(`.${rootName}`)
  )) ?? null
}

function hasWorkerAction(rule: EmailRule, workerName: string) {
  return (rule.actions ?? []).some((action) => {
    if (action.type !== 'worker') {
      return false
    }

    return Array.isArray(action.value) && action.value.includes(workerName)
  })
}

function hasLiteralMatcher(rule: EmailRule, emailPattern: string) {
  return (rule.matchers ?? []).some((matcher) => (
    matcher.type === 'literal'
      && matcher.field === 'to'
      && matcher.value === emailPattern
  ))
}

export function planSubdomainProvision(
  name: string,
  workerName: string,
  records: DnsRecord[],
  rules: EmailRule[],
  dnsMode: SubdomainDnsMode = 'compatible',
) {
  const normalizedName = normalizeName(name)
  const emailPattern = `*@${normalizedName}`
  const mxTargets = getMxTargets(dnsMode)
  const shouldCreateTxtRecord = dnsMode === 'compatible'

  const reusableMxRecords = mxTargets.map((target) => records.find((record) => (
    record.type === 'MX'
      && normalizeName(record.name) === normalizedName
      && normalizeRecordContent(record.content) === normalizeRecordContent(target.content)
  ))).filter((record): record is DnsRecord => Boolean(record))

  const reusableTxtRecord = records.find((record) => (
    record.type === 'TXT'
      && normalizeName(record.name) === normalizedName
      && normalizeRecordContent(record.content) === normalizeRecordContent(SPF_CONTENT)
  )) ?? null

  const exactRouteRule = rules.find((rule) => (
    rule.enabled !== false
      && hasLiteralMatcher(rule, emailPattern)
      && hasWorkerAction(rule, workerName)
  )) ?? null

  const conflictingRouteRule = rules.find((rule) => (
    hasLiteralMatcher(rule, emailPattern)
      && !hasWorkerAction(rule, workerName)
  )) ?? null

  return {
    mxTargetsToCreate: mxTargets.filter((target) => !reusableMxRecords.some((record) => (
      normalizeRecordContent(record.content) === normalizeRecordContent(target.content)
    ))),
    reusableMxRecordIds: reusableMxRecords.map((record) => record.id),
    txtRecordId: reusableTxtRecord?.id ?? null,
    needsTxtRecord: shouldCreateTxtRecord && !reusableTxtRecord,
    routeRuleId: exactRouteRule?.id ?? null,
    needsRouteRule: !exactRouteRule,
    conflictingRouteRuleId: conflictingRouteRule?.id ?? null,
  }
}

export function getManagedSubdomainConstants(dnsMode: SubdomainDnsMode = 'compatible') {
  const mxTargets = getMxTargets(dnsMode)
  const spfContent = dnsMode === 'compatible' ? SPF_CONTENT : null

  return {
    mxTargets,
    spfContent,
    dnsRecordsPerSubdomain: mxTargets.length + (spfContent ? 1 : 0),
  }
}
