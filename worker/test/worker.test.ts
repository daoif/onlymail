import assert from 'node:assert/strict'
import test from 'node:test'

import { sha256 } from '../src/lib/crypto'
import type { AddressRecord, AppBindings, DomainRecord } from '../src/types'
import type { DnsRecord, EmailRule } from '../src/providers/types'
import handler from '../src/worker'

type FakePreparedStatement = {
  bind: (...values: unknown[]) => FakePreparedStatement
  first: <T>() => Promise<T | null>
  all: <T>() => Promise<{ results: T[] }>
  run: () => Promise<unknown>
}

type FakeCallState = {
  settings: Map<string, string>
  domains: DomainRecord[]
  addresses: AddressRecord[]
  dnsRecords: DnsRecord[]
  emailRules: EmailRule[]
  cloudflareCalls: Array<{ method: string; path: string; body: unknown }>
  nextDomainId: number
  nextAddressId: number
  nextDnsId: number
  nextRuleId: number
}

function createFakeEnv() {
  const statement: FakePreparedStatement = {
    bind() {
      return statement
    },
    async first<T>() {
      return null as T | null
    },
    async all<T>() {
      return { results: [] as T[] }
    },
    async run() {
      return { success: true as const }
    },
  }

  return {
    DB: {
      prepare() {
        return statement
      },
    } as unknown as D1Database,
  }
}

function createD1RunResult(changes: number) {
  return {
    success: true,
    meta: {
      changes,
      rows_read: 0,
      rows_written: changes,
      duration: 0,
      last_row_id: 0,
      changed_db: changes > 0,
      size_after: 0,
    },
  }
}

function createDomain(overrides: Partial<DomainRecord> & Pick<DomainRecord, 'name'>): DomainRecord {
  const isRoot = overrides.is_root ?? 0
  const name = overrides.name.toLowerCase()

  return {
    id: overrides.id ?? 1,
    name,
    root_name: overrides.root_name ?? (isRoot === 1 ? name : 'example.com'),
    is_root: isRoot,
    subdomain_type: overrides.subdomain_type ?? (isRoot === 1 ? 'root' : 'temporary'),
    routing_enabled: overrides.routing_enabled ?? 1,
    cf_zone_id: overrides.cf_zone_id ?? 'zone-root',
    mx_record_ids: overrides.mx_record_ids ?? '[]',
    txt_record_id: overrides.txt_record_id ?? null,
    route_rule_id: overrides.route_rule_id ?? null,
    created_at: overrides.created_at ?? `2026-06-20T00:00:0${overrides.id ?? 1}.000Z`,
  }
}

function sortDomainsForList(rows: DomainRecord[]) {
  return [...rows].sort((left, right) => {
    const rootDiff = right.is_root - left.is_root
    return rootDiff !== 0 ? rootDiff : left.created_at.localeCompare(right.created_at)
  })
}

function createFakeCallEnv(state: FakeCallState) {
  const db = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, ' ').trim()
      let boundValues: unknown[] = []

      const statement: FakePreparedStatement = {
        bind(...values: unknown[]) {
          boundValues = values
          return statement
        },
        async first<T>() {
          if (normalized === 'SELECT key, value FROM settings WHERE key = ?1') {
            const key = String(boundValues[0])
            const value = state.settings.get(key)
            return value === undefined ? null as T | null : { key, value } as T
          }

          if (normalized === 'SELECT * FROM domains WHERE name = ?1') {
            const name = String(boundValues[0]).toLowerCase()
            return (state.domains.find((item) => item.name === name) ?? null) as T | null
          }

          if (normalized === 'SELECT * FROM address WHERE name = ?1') {
            const name = String(boundValues[0]).toLowerCase()
            return (state.addresses.find((item) => item.name === name) ?? null) as T | null
          }

          return null as T | null
        },
        async all<T>() {
          if (normalized === 'SELECT * FROM domains WHERE is_root = 1 ORDER BY length(name) DESC, created_at ASC') {
            return {
              results: [...state.domains]
                .filter((item) => item.is_root === 1)
                .sort((left, right) => right.name.length - left.name.length || left.created_at.localeCompare(right.created_at)) as T[],
            }
          }

          if (normalized.startsWith('SELECT * FROM domains') && normalized.includes('ORDER BY is_root DESC, created_at ASC')) {
            let bindIndex = 0
            let rows = [...state.domains]

            if (normalized.includes('is_root = ?')) {
              const isRoot = Number(boundValues[bindIndex++])
              rows = rows.filter((item) => item.is_root === isRoot)
            }

            if (normalized.includes('root_name = ?')) {
              const rootName = String(boundValues[bindIndex++]).toLowerCase()
              rows = rows.filter((item) => item.root_name === rootName)
            }

            if (normalized.includes('subdomain_type = ?')) {
              const subdomainType = String(boundValues[bindIndex++])
              rows = rows.filter((item) => item.subdomain_type === subdomainType)
            }

            rows = sortDomainsForList(rows)

            if (normalized.includes(' LIMIT ?')) {
              rows = rows.slice(0, Number(boundValues[bindIndex++]))
            }

            return { results: rows as T[] }
          }

          return { results: [] as T[] }
        },
        async run() {
          if (normalized.startsWith('INSERT INTO address')) {
            const name = String(boundValues[0]).toLowerCase()
            const domain = String(boundValues[1]).toLowerCase()
            const project = String(boundValues[2])
            const ttlHours = Number(boundValues[3])
            const existing = state.addresses.find((item) => item.name === name)
            if (!existing) {
              state.addresses.push({
                id: state.nextAddressId++,
                name,
                domain,
                project,
                ttl_hours: ttlHours,
                created_at: '2026-06-20T01:00:00.000Z',
                updated_at: '2026-06-20T01:00:00.000Z',
              })
            }
            return createD1RunResult(existing ? 0 : 1)
          }

          if (normalized.startsWith('INSERT INTO domains (name, root_name, is_root, subdomain_type')) {
            const name = String(boundValues[0]).toLowerCase()
            const existing = state.domains.find((item) => item.name === name)
            const next = createDomain({
              id: existing?.id ?? state.nextDomainId++,
              name,
              root_name: String(boundValues[1]).toLowerCase(),
              is_root: 0,
              subdomain_type: String(boundValues[2]) as DomainRecord['subdomain_type'],
              routing_enabled: 1,
              cf_zone_id: String(boundValues[3]),
              mx_record_ids: String(boundValues[4]),
              txt_record_id: boundValues[5] === null ? null : String(boundValues[5]),
              route_rule_id: boundValues[6] === null ? null : String(boundValues[6]),
              created_at: existing?.created_at ?? '2026-06-20T02:00:00.000Z',
            })

            if (existing) {
              Object.assign(existing, next)
            } else {
              state.domains.push(next)
            }

            return createD1RunResult(1)
          }

          throw new Error(`未处理的 SQL: ${normalized}`)
        },
      }

      return statement
    },
  } as unknown as D1Database

  return {
    DB: db,
    CF_API_TOKEN: 'cf-token',
    CF_EMAIL: 'admin@example.com',
    CF_GLOBAL_API_KEY: 'cf-global-key',
  } satisfies AppBindings
}

async function createCallFixture(domains: DomainRecord[] = []) {
  const apiKey = 'test-api-key'
  const state: FakeCallState = {
    settings: new Map([
      ['api_key_hash', await sha256(apiKey)],
      ['api_key_preview', 'test...-key'],
      ['api_key_rotated_at', '2026-06-20T00:00:00.000Z'],
      ['subdomain_dns_mode', 'compatible'],
    ]),
    domains,
    addresses: [],
    dnsRecords: [],
    emailRules: [],
    cloudflareCalls: [],
    nextDomainId: Math.max(0, ...domains.map((item) => item.id)) + 1,
    nextAddressId: 1,
    nextDnsId: 1,
    nextRuleId: 1,
  }

  return {
    apiKey,
    state,
    env: createFakeCallEnv(state),
  }
}

async function callRequest(env: AppBindings, apiKey: string, path: string, init: RequestInit = {}) {
  return handler.fetch(
    new Request(`https://example.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    }),
    env,
    {} as ExecutionContext,
  )
}

function createCloudflareEnvelope(result: unknown, resultInfo?: Record<string, number>) {
  return Response.json({
    success: true,
    result,
    result_info: resultInfo,
    errors: [],
    messages: [],
  })
}

async function withFakeCloudflare(state: FakeCallState, action: () => Promise<void>) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    const path = `${url.pathname}${url.search}`.replace('/client/v4', '')
    const method = request.method.toUpperCase()
    const bodyText = method === 'GET' ? '' : await request.clone().text()
    const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : null

    state.cloudflareCalls.push({ method, path, body })

    if (method === 'GET' && path.startsWith('/zones/zone-root/dns_records')) {
      const name = url.searchParams.get('name')
      const records = state.dnsRecords.filter((record) => !name || record.name === name)
      return createCloudflareEnvelope(records, {
        page: 1,
        per_page: 100,
        count: records.length,
        total_count: records.length,
        total_pages: 1,
      })
    }

    if (method === 'GET' && path === '/zones/zone-root') {
      return createCloudflareEnvelope({
        id: 'zone-root',
        name: 'example.com',
        status: 'active',
        name_servers: [],
        created_on: '2026-06-20T00:00:00.000Z',
        plan: { legacy_id: 'free' },
      })
    }

    if (method === 'GET' && path.startsWith('/zones/zone-root/email/routing/rules')) {
      return createCloudflareEnvelope(state.emailRules, {
        page: 1,
        per_page: 50,
        count: state.emailRules.length,
        total_count: state.emailRules.length,
        total_pages: 1,
      })
    }

    if (method === 'POST' && path === '/zones/zone-root/dns_records') {
      const record: DnsRecord = {
        id: `dns-${state.nextDnsId++}`,
        type: String(body?.type),
        name: String(body?.name).toLowerCase(),
        content: String(body?.content),
        priority: body?.priority === undefined ? undefined : Number(body.priority),
      }
      state.dnsRecords.push(record)
      return createCloudflareEnvelope(record)
    }

    if (method === 'POST' && path === '/zones/zone-root/email/routing/rules') {
      const rule: EmailRule = {
        id: `rule-${state.nextRuleId++}`,
        name: typeof body?.name === 'string' ? body.name : undefined,
        enabled: true,
        actions: body?.actions as EmailRule['actions'],
        matchers: body?.matchers as EmailRule['matchers'],
      }
      state.emailRules.push(rule)
      return createCloudflareEnvelope(rule)
    }

    throw new Error(`未处理的 Cloudflare 请求: ${method} ${path}`)
  }

  try {
    await action()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('health 端点可访问', async () => {
  const response = await handler.fetch(new Request('https://example.com/health'), createFakeEnv(), {} as ExecutionContext)
  assert.equal(response.status, 200)
  const payload = await response.json() as { data: { ok: boolean } }
  assert.equal(payload.data.ok, true)
})

test('/api/* 在缺少管理员会话时返回 401', async () => {
  const response = await handler.fetch(new Request('https://example.com/api/dashboard'), createFakeEnv(), {} as ExecutionContext)
  assert.equal(response.status, 401)
})

test('POST /call/domains 已就绪子域名走 D1 fast path，不调用 Cloudflare', async () => {
  const root = createDomain({
    id: 1,
    name: 'example.com',
    is_root: 1,
    subdomain_type: 'root',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
  })
  const subdomain = createDomain({
    id: 2,
    name: 'm1.example.com',
    root_name: 'example.com',
    is_root: 0,
    subdomain_type: 'temporary',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
    mx_record_ids: JSON.stringify(['mx-1', 'mx-2', 'mx-3']),
    txt_record_id: 'txt-1',
    route_rule_id: 'rule-1',
  })
  const { env, apiKey, state } = await createCallFixture([root, subdomain])

  await withFakeCloudflare(state, async () => {
    const response = await callRequest(env, apiKey, '/call/domains', {
      method: 'POST',
      body: JSON.stringify({ name: 'm1.example.com' }),
    })
    const payload = await response.json() as { data: DomainRecord }

    assert.equal(response.status, 201)
    assert.equal(payload.data.name, 'm1.example.com')
    assert.equal(payload.data.route_rule_id, 'rule-1')
  })

  assert.deepEqual(state.cloudflareCalls, [])
})

test('POST /call/domains 已存在但资源 ID 不完整时继续 provisioning', async () => {
  const root = createDomain({
    id: 1,
    name: 'example.com',
    is_root: 1,
    subdomain_type: 'root',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
  })
  const incomplete = createDomain({
    id: 2,
    name: 'm2.example.com',
    root_name: 'example.com',
    is_root: 0,
    subdomain_type: 'temporary',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
    mx_record_ids: JSON.stringify(['mx-existing']),
    txt_record_id: null,
    route_rule_id: null,
  })
  const { env, apiKey, state } = await createCallFixture([root, incomplete])
  state.dnsRecords.push({
    id: 'mx-existing',
    type: 'MX',
    name: 'm2.example.com',
    content: 'route1.mx.cloudflare.net',
    priority: 86,
  })

  await withFakeCloudflare(state, async () => {
    const response = await callRequest(env, apiKey, '/call/domains', {
      method: 'POST',
      body: JSON.stringify({ name: 'm2.example.com' }),
    })
    const payload = await response.json() as { data: DomainRecord }

    assert.equal(response.status, 201)
    assert.equal(payload.data.name, 'm2.example.com')
    assert.deepEqual(JSON.parse(payload.data.mx_record_ids), ['mx-existing', 'dns-1', 'dns-2'])
    assert.equal(payload.data.txt_record_id, 'dns-3')
    assert.equal(payload.data.route_rule_id, 'rule-1')
  })

  assert.ok(state.cloudflareCalls.some((item) => item.method === 'GET' && item.path.startsWith('/zones/zone-root/dns_records')))
  assert.ok(state.cloudflareCalls.some((item) => item.method === 'GET' && item.path.startsWith('/zones/zone-root/email/routing/rules')))
  assert.ok(state.cloudflareCalls.some((item) => item.method === 'GET' && item.path === '/zones/zone-root'))
  assert.equal(state.cloudflareCalls.filter((item) => item.method === 'POST' && item.path === '/zones/zone-root/dns_records').length, 3)
  assert.equal(state.cloudflareCalls.filter((item) => item.method === 'POST' && item.path === '/zones/zone-root/email/routing/rules').length, 1)
})

test('GET /call/domains 使用 D1-only 轻量列表，不触发 Cloudflare inventory', async () => {
  const root = createDomain({
    id: 1,
    name: 'example.com',
    is_root: 1,
    subdomain_type: 'root',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
  })
  const subdomain = createDomain({
    id: 2,
    name: 'm1.example.com',
    root_name: 'example.com',
    is_root: 0,
    subdomain_type: 'permanent',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
    mx_record_ids: JSON.stringify(['mx-1', 'mx-2', 'mx-3']),
    txt_record_id: 'txt-1',
    route_rule_id: 'rule-1',
  })
  const { env, apiKey, state } = await createCallFixture([root, subdomain])

  await withFakeCloudflare(state, async () => {
    const response = await callRequest(env, apiKey, '/call/domains?type=sub&root=example.com')
    const payload = await response.json() as { data: DomainRecord[] }

    assert.equal(response.status, 200)
    assert.deepEqual(payload.data.map((item) => item.name), ['m1.example.com'])
    assert.equal(payload.data[0].subdomain_type, 'permanent')
    assert.equal(payload.data[0].routing_enabled, 1)
    assert.equal(payload.data[0].managed_dns_count, undefined)
    assert.equal(payload.data[0].cf_dns_record_count, undefined)
  })

  assert.deepEqual(state.cloudflareCalls, [])
})

test('POST /call/address 按 D1 ready 状态拒绝未就绪域名并允许 ready 域名', async () => {
  const readyRoot = createDomain({
    id: 1,
    name: 'example.com',
    is_root: 1,
    subdomain_type: 'root',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
  })
  const readySubdomain = createDomain({
    id: 2,
    name: 'm1.example.com',
    root_name: 'example.com',
    is_root: 0,
    subdomain_type: 'temporary',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
    mx_record_ids: JSON.stringify(['mx-1', 'mx-2', 'mx-3']),
    txt_record_id: 'txt-1',
    route_rule_id: 'rule-1',
  })
  const incompleteSubdomain = createDomain({
    id: 3,
    name: 'bad.example.com',
    root_name: 'example.com',
    is_root: 0,
    subdomain_type: 'temporary',
    routing_enabled: 1,
    cf_zone_id: 'zone-root',
    mx_record_ids: JSON.stringify(['mx-1']),
    txt_record_id: null,
    route_rule_id: null,
  })
  const { env, apiKey, state } = await createCallFixture([readyRoot, readySubdomain, incompleteSubdomain])

  await withFakeCloudflare(state, async () => {
    const missingResponse = await callRequest(env, apiKey, '/call/address', {
      method: 'POST',
      body: JSON.stringify({ address: 'alice@missing.example.com', project: 'ib' }),
    })
    const missingPayload = await missingResponse.json() as { error: { message: string; details: { reason: string } } }
    assert.equal(missingResponse.status, 400)
    assert.equal(missingPayload.error.message, 'domain_not_ready')
    assert.equal(missingPayload.error.details.reason, 'domain_not_found')

    const incompleteResponse = await callRequest(env, apiKey, '/call/address', {
      method: 'POST',
      body: JSON.stringify({ address: 'bob@bad.example.com', project: 'ib' }),
    })
    const incompletePayload = await incompleteResponse.json() as { error: { message: string; details: { reason: string } } }
    assert.equal(incompleteResponse.status, 400)
    assert.equal(incompletePayload.error.message, 'domain_not_ready')
    assert.equal(incompletePayload.error.details.reason, 'missing_route_rule_id')

    const readyResponse = await callRequest(env, apiKey, '/call/address', {
      method: 'POST',
      body: JSON.stringify({ address: 'carol@m1.example.com', project: 'ib', ttl_hours: 6 }),
    })
    const readyPayload = await readyResponse.json() as { data: { status: string; address: AddressRecord } }
    assert.equal(readyResponse.status, 201)
    assert.equal(readyPayload.data.status, 'created')
    assert.equal(readyPayload.data.address.name, 'carol@m1.example.com')
    assert.equal(readyPayload.data.address.ttl_hours, 6)
  })

  assert.deepEqual(state.cloudflareCalls, [])
  assert.deepEqual(state.addresses.map((item) => item.name), ['carol@m1.example.com'])
})
