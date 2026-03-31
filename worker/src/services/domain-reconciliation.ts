import type { DnsRecord, EmailRule } from '../providers/types'

const MX_TARGETS = [
  { content: 'route1.mx.cloudflare.net', priority: 86 },
  { content: 'route2.mx.cloudflare.net', priority: 23 },
  { content: 'route3.mx.cloudflare.net', priority: 50 },
] as const

const SPF_CONTENT = 'v=spf1 include:_spf.mx.cloudflare.net ~all'

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\.+$/, '')
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

export function planSubdomainProvision(name: string, workerName: string, records: DnsRecord[], rules: EmailRule[]) {
  const normalizedName = normalizeName(name)
  const emailPattern = `*@${normalizedName}`

  const reusableMxRecords = MX_TARGETS.map((target) => records.find((record) => (
    record.type === 'MX'
      && normalizeName(record.name) === normalizedName
      && record.content === target.content
      && record.priority === target.priority
  ))).filter((record): record is DnsRecord => Boolean(record))

  const reusableTxtRecord = records.find((record) => (
    record.type === 'TXT'
      && normalizeName(record.name) === normalizedName
      && record.content === SPF_CONTENT
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
    mxTargetsToCreate: MX_TARGETS.filter((target) => !reusableMxRecords.some((record) => (
      record.content === target.content && record.priority === target.priority
    ))),
    reusableMxRecordIds: reusableMxRecords.map((record) => record.id),
    txtRecordId: reusableTxtRecord?.id ?? null,
    needsTxtRecord: !reusableTxtRecord,
    routeRuleId: exactRouteRule?.id ?? null,
    needsRouteRule: !exactRouteRule,
    conflictingRouteRuleId: conflictingRouteRule?.id ?? null,
  }
}

export function getManagedSubdomainConstants() {
  return {
    mxTargets: [...MX_TARGETS],
    spfContent: SPF_CONTENT,
  }
}
