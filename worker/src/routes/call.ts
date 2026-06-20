/**
 * /call/* — API Key 认证路由（SDK 受控子集）
 *
 * 5 个端点：只创建 + 只读。无 DELETE，无设置操作。
 */

import { Hono } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../types'

import { AppError, jsonSuccess } from '../lib/http'
import { getPageParams, toPagination } from '../lib/pagination'

import { createOrInspectAddress } from '../services/address'
import { createSubdomain, getDomainDetail, listDomainsLightweight } from '../services/domain'
import { getMailById, listMailsForAddress } from '../services/mail'

// ── Schemas ───────────────────────────────────────────────────

const createAddressSchema = z.object({
  address: z.string().email(),
  project: z.string().min(1).max(120),
  ttl_hours: z.number().int().min(0).max(24 * 365).optional(),
})

const createDomainSchema = z.object({
  name: z.string().min(1),
  rootName: z.string().min(1).optional(),
  subdomainType: z.enum(['permanent', 'temporary']).optional(),
})

export const callRoutes = new Hono<AppEnv>()

type CallLogFields = {
  endpoint: string
  address?: string
  domain?: string
  project?: string
}

function getErrorCode(error: unknown) {
  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.name || 'error'
  }

  return 'unknown_error'
}

async function withCallTiming<T>(fields: CallLogFields, action: () => Promise<T>) {
  const startedAt = Date.now()
  try {
    const result = await action()
    console.info(JSON.stringify({
      event: 'onlymail.call',
      ...fields,
      duration_ms: Date.now() - startedAt,
      status: 'ok',
    }))
    return result
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'onlymail.call',
      ...fields,
      duration_ms: Date.now() - startedAt,
      status: 'error',
      error_code: getErrorCode(error),
    }))
    throw error
  }
}

// POST /call/address — 创建邮箱地址
callRoutes.post('/address', async (c) => {
  const logFields: CallLogFields = {
    endpoint: 'POST /call/address',
  }
  const result = await withCallTiming(logFields, async () => {
    const payload = createAddressSchema.parse(await c.req.json())
    const domain = payload.address.split('@')[1]?.toLowerCase() ?? ''
    logFields.address = payload.address.toLowerCase()
    logFields.domain = domain
    logFields.project = payload.project

    return createOrInspectAddress(c.env, {
      address: payload.address,
      project: payload.project,
      ttlHours: payload.ttl_hours ?? 24,
    })
  })

  return jsonSuccess(c, result, result.status === 'created' ? 201 : 200)
})

// GET /call/mails/:address — 按地址查邮件列表
callRoutes.get('/mails/:address', async (c) => {
  const pageParams = getPageParams(c)
  const result = await listMailsForAddress(c.env, decodeURIComponent(c.req.param('address')), pageParams)
  return jsonSuccess(c, {
    items: result.items,
    pagination: toPagination(result.total, pageParams),
  })
})

// GET /call/mail/:id — 邮件详情
callRoutes.get('/mail/:id', async (c) => {
  const mail = await getMailById(c.env, Number.parseInt(c.req.param('id'), 10))
  if (!mail) {
    throw new AppError(404, '邮件不存在')
  }

  return jsonSuccess(c, mail)
})

// GET /call/domains — 列出可用域名
callRoutes.get('/domains', async (c) => {
  const type = c.req.query('type') as 'root' | 'sub' | undefined
  const root = c.req.query('root') ?? undefined
  const rawSubdomainType = c.req.query('subdomainType')
  const subdomainType = rawSubdomainType === 'permanent' || rawSubdomainType === 'temporary'
    ? rawSubdomainType
    : undefined
  const limitStr = c.req.query('limit')
  const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined

  return jsonSuccess(c, await withCallTiming({
    endpoint: 'GET /call/domains',
    domain: root,
  }, () => listDomainsLightweight(c.env, { type, root, subdomainType, limit })))
})

// GET /call/domains/:name — 单个域名详情
callRoutes.get('/domains/:name', async (c) => {
  const detail = await getDomainDetail(c.env, decodeURIComponent(c.req.param('name')))
  if (!detail) {
    throw new AppError(404, '域名不存在')
  }

  return jsonSuccess(c, detail)
})

// POST /call/domains — 创建子域名
callRoutes.post('/domains', async (c) => {
  const logFields: CallLogFields = {
    endpoint: 'POST /call/domains',
  }
  const result = await withCallTiming(logFields, async () => {
    const payload = createDomainSchema.parse(await c.req.json())
    logFields.domain = payload.name.trim().toLowerCase()

    return createSubdomain(c.env, {
      ...payload,
      subdomainType: payload.subdomainType ?? 'temporary',
    })
  })

  return jsonSuccess(c, result, 201)
})
