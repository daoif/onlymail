import assert from 'node:assert/strict'
import test from 'node:test'

import { findNearestRootDomainName, planSubdomainProvision } from '../src/services/domain-reconciliation'

test('planSubdomainProvision 会复用已经就绪的 DNS 和 Email Routing 资源', () => {
  const plan = planSubdomainProvision(
    'm1.example.com',
    'onlymail-worker',
    [
      { id: 'mx-1', type: 'MX', name: 'm1.example.com', content: 'route1.mx.cloudflare.net', priority: 86 },
      { id: 'mx-2', type: 'MX', name: 'm1.example.com', content: 'route2.mx.cloudflare.net', priority: 23 },
      { id: 'mx-3', type: 'MX', name: 'm1.example.com', content: 'route3.mx.cloudflare.net', priority: 50 },
      { id: 'txt-1', type: 'TXT', name: 'm1.example.com', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' },
    ],
    [
      {
        id: 'rule-1',
        enabled: true,
        actions: [{ type: 'worker', value: ['onlymail-worker'] }],
        matchers: [{ type: 'literal', field: 'to', value: '*@m1.example.com' }],
      },
    ],
  )

  assert.deepEqual(plan.reusableMxRecordIds, ['mx-1', 'mx-2', 'mx-3'])
  assert.deepEqual(plan.mxTargetsToCreate, [])
  assert.equal(plan.txtRecordId, 'txt-1')
  assert.equal(plan.needsTxtRecord, false)
  assert.equal(plan.routeRuleId, 'rule-1')
  assert.equal(plan.needsRouteRule, false)
  assert.equal(plan.conflictingRouteRuleId, null)
})

test('planSubdomainProvision 会识别缺失资源和冲突规则', () => {
  const plan = planSubdomainProvision(
    'm1.example.com',
    'onlymail-worker',
    [
      { id: 'mx-1', type: 'MX', name: 'm1.example.com', content: 'route1.mx.cloudflare.net', priority: 86 },
    ],
    [
      {
        id: 'rule-2',
        enabled: true,
        actions: [{ type: 'worker', value: ['other-worker'] }],
        matchers: [{ type: 'literal', field: 'to', value: '*@m1.example.com' }],
      },
    ],
  )

  assert.deepEqual(
    plan.mxTargetsToCreate.map((item) => `${item.content}:${item.priority}`),
    ['route2.mx.cloudflare.net:23', 'route3.mx.cloudflare.net:50'],
  )
  assert.equal(plan.txtRecordId, null)
  assert.equal(plan.needsTxtRecord, true)
  assert.equal(plan.routeRuleId, null)
  assert.equal(plan.needsRouteRule, true)
  assert.equal(plan.conflictingRouteRuleId, 'rule-2')
})

test('planSubdomainProvision 在精简 DNS 模式只要求 1 条 MX', () => {
  const plan = planSubdomainProvision(
    'm1.example.com',
    'onlymail-worker',
    [],
    [],
    'minimal',
  )

  assert.deepEqual(
    plan.mxTargetsToCreate.map((item) => item.content),
    ['route1.mx.cloudflare.net'],
  )
  assert.equal(plan.needsTxtRecord, false)
  assert.equal(plan.txtRecordId, null)
})

test('planSubdomainProvision 会复用不同优先级或尾点格式的 MX', () => {
  const plan = planSubdomainProvision(
    'm1.example.com',
    'onlymail-worker',
    [
      { id: 'mx-1', type: 'MX', name: 'm1.example.com.', content: 'route1.mx.cloudflare.net.', priority: 39 },
    ],
    [],
    'minimal',
  )

  assert.deepEqual(plan.reusableMxRecordIds, ['mx-1'])
  assert.deepEqual(plan.mxTargetsToCreate, [])
})

test('findNearestRootDomainName 会匹配最近的已初始化根域名', () => {
  assert.equal(
    findNearestRootDomainName('m1.m1.ainiaini.xyz', ['ainiaini.xyz', 'other.com']),
    'ainiaini.xyz',
  )

  assert.equal(
    findNearestRootDomainName('a.deep.example.com', ['example.com', 'deep.example.com']),
    'deep.example.com',
  )

  assert.equal(findNearestRootDomainName('isolated.test', ['example.com']), null)
})
