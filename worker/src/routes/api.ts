/**
 * /api/* — JWT 认证路由（前端完整权限）
 *
 * 承载前端管理面板的完整能力；认证相关端点（init-status / init / login）无需 JWT。
 */

import { Hono } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../types'

import { createAdminToken } from '../lib/crypto'
import { AppError, jsonMessage, jsonSuccess } from '../lib/http'
import { getPageParams, toPagination } from '../lib/pagination'

import { createOrInspectAddress, deleteAddress, listAddresses } from '../services/address'
import { bootstrapRootDomain, createSubdomain, deleteSubdomain, getDomainDetail, listDomains } from '../services/domain'
import { deleteMail, getMailById, listMails } from '../services/mail'
import {
  addAllowedOriginPattern,
  changeAdminPassword,
  getAdminUsername,
  getApiKeyConfig,
  initAdmin,
  isAdminInitialized,
  removeAllowedOriginPattern,
  rotateApiKey,
  verifyAdmin,
} from '../services/settings'
import { getDashboardStats } from '../services/stats'
import { createProviders } from '../providers/index'

// ── Schemas ───────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const initSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const createAddressSchema = z.object({
  address: z.string().email(),
  project: z.string().min(1).max(120),
  ttl_hours: z.number().int().min(0).max(24 * 365).optional(),
})

const bootstrapSchema = z.object({
  rootDomain: z.string().min(1),
  zoneId: z.string().min(1).optional(),
})

const createDomainSchema = z.object({
  name: z.string().min(1),
  rootName: z.string().min(1).optional(),
  workerName: z.string().min(1).optional(),
})

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(1),
})

export const apiRoutes = new Hono<AppEnv>()

// ── 认证（无需 JWT） ─────────────────────────────────────────

apiRoutes.get('/init-status', async (c) =>
  jsonSuccess(c, {
    initialized: await isAdminInitialized(c.env),
  }),
)

apiRoutes.post('/init', async (c) => {
  const payload = initSchema.parse(await c.req.json())
  return jsonSuccess(c, await initAdmin(c.env, payload.username, payload.password), 201)
})

apiRoutes.post('/login', async (c) => {
  const payload = loginSchema.parse(await c.req.json())

  const verified = await verifyAdmin(c.env, payload.username, payload.password)
  if (!verified) {
    throw new AppError(401, '账号或密码错误')
  }

  const token = await createAdminToken(payload.username, c.env.JWT_SECRET)
  return jsonSuccess(c, {
    token,
    username: payload.username,
  })
})

// ── Dashboard ─────────────────────────────────────────────────

apiRoutes.get('/dashboard', async (c) => jsonSuccess(c, await getDashboardStats(c.env)))

// ── 地址管理 ──────────────────────────────────────────────────

apiRoutes.post('/address', async (c) => {
  const payload = createAddressSchema.parse(await c.req.json())
  const result = await createOrInspectAddress(c.env, {
    address: payload.address,
    project: payload.project,
    ttlHours: payload.ttl_hours ?? 24,
  })

  return jsonSuccess(c, result, result.status === 'created' ? 201 : 200)
})

apiRoutes.get('/addresses', async (c) => {
  const pageParams = getPageParams(c)
  const result = await listAddresses(c.env, pageParams, {
    domain: c.req.query('domain') ?? undefined,
    project: c.req.query('project') ?? undefined,
  })

  return jsonSuccess(c, {
    items: result.items,
    pagination: toPagination(result.total, pageParams),
  })
})

apiRoutes.delete('/address/:name', async (c) => {
  const deleted = await deleteAddress(c.env, decodeURIComponent(c.req.param('name')))
  if (!deleted) {
    throw new AppError(404, '邮箱地址不存在')
  }

  return jsonMessage(c, '邮箱地址已删除')
})

// ── 邮件管理 ──────────────────────────────────────────────────

apiRoutes.get('/mails', async (c) => {
  const pageParams = getPageParams(c)
  const result = await listMails(c.env, pageParams, c.req.query('address') ?? undefined)

  return jsonSuccess(c, {
    items: result.items,
    pagination: toPagination(result.total, pageParams),
  })
})

apiRoutes.get('/mail/:id', async (c) => {
  const mail = await getMailById(c.env, Number.parseInt(c.req.param('id'), 10))
  if (!mail) {
    throw new AppError(404, '邮件不存在')
  }

  return jsonSuccess(c, mail)
})

apiRoutes.delete('/mail/:id', async (c) => {
  const deleted = await deleteMail(c.env, Number.parseInt(c.req.param('id'), 10))
  if (!deleted) {
    throw new AppError(404, '邮件不存在')
  }

  return jsonMessage(c, '邮件已删除')
})

// ── 域名管理 ──────────────────────────────────────────────────

apiRoutes.post('/domains/bootstrap', async (c) => {
  const payload = bootstrapSchema.parse(await c.req.json())
  return jsonSuccess(c, await bootstrapRootDomain(c.env, payload), 201)
})

apiRoutes.get('/domains', async (c) => {
  const type = c.req.query('type') as 'root' | 'sub' | undefined
  const root = c.req.query('root') ?? undefined
  const limitStr = c.req.query('limit')
  const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined

  return jsonSuccess(c, await listDomains(c.env, { type, root, limit }))
})

apiRoutes.get('/domains/:name', async (c) => {
  const detail = await getDomainDetail(c.env, decodeURIComponent(c.req.param('name')))
  if (!detail) {
    throw new AppError(404, '域名不存在')
  }

  return jsonSuccess(c, detail)
})

apiRoutes.post('/domains', async (c) => {
  const payload = createDomainSchema.parse(await c.req.json())
  return jsonSuccess(c, await createSubdomain(c.env, payload), 201)
})

apiRoutes.delete('/domains/:name', async (c) => {
  const deleted = await deleteSubdomain(c.env, decodeURIComponent(c.req.param('name')))
  if (!deleted) {
    throw new AppError(404, '域名不存在')
  }

  return jsonMessage(c, '域名已删除')
})

// ── 系统设置 ──────────────────────────────────────────────────

apiRoutes.get('/settings/api-key', async (c) => {
  const [config, adminUser] = await Promise.all([getApiKeyConfig(c.env), getAdminUsername(c.env)])
  return jsonSuccess(c, {
    configured: config.configured,
    preview: config.preview,
    rotatedAt: config.rotatedAt,
    adminUser: adminUser ?? '',
  })
})

apiRoutes.post('/settings/api-key/rotate', async (c) => jsonSuccess(c, await rotateApiKey(c.env), 201))

apiRoutes.post('/settings/change-password', async (c) => {
  const payload = changePasswordSchema.parse(await c.req.json())
  await changeAdminPassword(c.env, payload.oldPassword, payload.newPassword)
  return jsonMessage(c, '密码已更新')
})

// ── 自定义域名绑定 ────────────────────────────────────────────

apiRoutes.get('/settings/custom-domains', async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID
  if (!accountId) {
    throw new AppError(500, 'CF_ACCOUNT_ID 未配置')
  }

  const providers = createProviders(c.env)
  const domains = await providers.domainBinding.listWorkerDomains(accountId)
  const workerName = c.env.CF_DEFAULT_WORKER_NAME || 'mails-worker'
  const filtered = domains.filter((d) => d.service === workerName)
  return jsonSuccess(c, filtered)
})

apiRoutes.post('/settings/custom-domains', async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID
  if (!accountId) {
    throw new AppError(500, 'CF_ACCOUNT_ID 未配置')
  }

  const { hostname, zoneId } = z.object({ hostname: z.string().min(1), zoneId: z.string().optional() }).parse(await c.req.json())
  const workerName = c.env.CF_DEFAULT_WORKER_NAME || 'mails-worker'
  const providers = createProviders(c.env)
  const resolvedZoneId = await providers.dns.resolveZoneId(hostname, zoneId?.trim())
  const result = await providers.domainBinding.addWorkerDomain(accountId, hostname, resolvedZoneId, workerName)
  return jsonSuccess(c, result, 201)
})

apiRoutes.delete('/settings/custom-domains/:id', async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID
  if (!accountId) {
    throw new AppError(500, 'CF_ACCOUNT_ID 未配置')
  }

  const providers = createProviders(c.env)
  await providers.domainBinding.removeWorkerDomain(accountId, c.req.param('id'))
  return jsonMessage(c, '自定义域名已移除')
})

// ── Pages 自定义域名 ──────────────────────────────────────────

apiRoutes.get('/settings/pages-domains', async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID
  const projectName = c.env.CF_DEFAULT_PAGES_PROJECT
  if (!accountId || !projectName) {
    throw new AppError(500, 'CF_ACCOUNT_ID 或 CF_DEFAULT_PAGES_PROJECT 未配置')
  }

  const providers = createProviders(c.env)
  const domains = await providers.domainBinding.listPagesDomains(accountId, projectName)
  return jsonSuccess(c, domains)
})

apiRoutes.post('/settings/pages-domains', async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID
  const projectName = c.env.CF_DEFAULT_PAGES_PROJECT
  if (!accountId || !projectName) {
    throw new AppError(500, 'CF_ACCOUNT_ID 或 CF_DEFAULT_PAGES_PROJECT 未配置')
  }

  const providers = createProviders(c.env)
  const { domain, zoneId } = z.object({ domain: z.string().min(1), zoneId: z.string().optional() }).parse(await c.req.json())
  const resolvedZoneId = await providers.dns.resolveZoneId(domain, zoneId?.trim())
  await providers.domainBinding.addPagesDomain(accountId, projectName, domain)

  const pagesSubdomain = await providers.domainBinding.getPagesProjectSubdomain(accountId, projectName)
  const existingRecords = await providers.dns.listDnsRecords(resolvedZoneId, { type: 'CNAME', name: domain })
  const currentRecord = existingRecords[0]
  const recordPayload = {
    type: 'CNAME',
    name: domain,
    content: pagesSubdomain,
    proxied: false,
  }

  if (!currentRecord) {
    await providers.dns.createDnsRecord(resolvedZoneId, recordPayload)
  } else if (currentRecord.content !== pagesSubdomain) {
    await providers.dns.updateDnsRecord(resolvedZoneId, currentRecord.id, recordPayload)
  }

  const result = await providers.domainBinding.retryPagesDomainValidation(accountId, projectName, domain)
  await addAllowedOriginPattern(c.env, `https://${domain}`)
  return jsonSuccess(c, result, 201)
})

apiRoutes.delete('/settings/pages-domains/:domain', async (c) => {
  const accountId = c.env.CF_ACCOUNT_ID
  const projectName = c.env.CF_DEFAULT_PAGES_PROJECT
  if (!accountId || !projectName) {
    throw new AppError(500, 'CF_ACCOUNT_ID 或 CF_DEFAULT_PAGES_PROJECT 未配置')
  }

  const domainName = decodeURIComponent(c.req.param('domain'))
  const providers = createProviders(c.env)
  let resolvedZoneId = ''

  try {
    resolvedZoneId = await providers.dns.resolveZoneId(domainName)
  } catch {
    resolvedZoneId = ''
  }

  const pagesSubdomain = resolvedZoneId
    ? await providers.domainBinding.getPagesProjectSubdomain(accountId, projectName)
    : null

  await providers.domainBinding.removePagesDomain(accountId, projectName, domainName)

  if (resolvedZoneId && pagesSubdomain) {
    const existingRecords = await providers.dns.listDnsRecords(resolvedZoneId, { type: 'CNAME', name: domainName })
    const matchedRecords = existingRecords.filter((record) => record.content === pagesSubdomain)

    for (const record of matchedRecords) {
      await providers.dns.deleteDnsRecord(resolvedZoneId, record.id)
    }
  }

  await removeAllowedOriginPattern(c.env, `https://${domainName}`)
  return jsonMessage(c, 'Pages 自定义域名已移除')
})




