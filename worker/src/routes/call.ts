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
import { createSubdomain, getDomainDetail, listDomains } from '../services/domain'
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
  workerName: z.string().min(1).optional(),
})

export const callRoutes = new Hono<AppEnv>()

// POST /call/address — 创建邮箱地址
callRoutes.post('/address', async (c) => {
  const payload = createAddressSchema.parse(await c.req.json())
  const result = await createOrInspectAddress(c.env, {
    address: payload.address,
    project: payload.project,
    ttlHours: payload.ttl_hours ?? 24,
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
  const limitStr = c.req.query('limit')
  const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined

  return jsonSuccess(c, await listDomains(c.env, { type, root, limit }))
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
  const payload = createDomainSchema.parse(await c.req.json())
  return jsonSuccess(c, await createSubdomain(c.env, payload), 201)
})
