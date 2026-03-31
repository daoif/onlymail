import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { AppBindings, AppEnv } from './types'

import { AppError, jsonError, jsonSuccess } from './lib/http'
import { handleEmail } from './email'
import { apiRoutes } from './routes/api'
import { callRoutes } from './routes/call'
import { handleScheduled } from './scheduled'
import { verifyAdminSession } from './services/admin-session'
import { getAllowedOriginPatterns, getApiKeyConfig, verifyApiKey } from './services/settings'

const app = new Hono<AppEnv>()

function matchesAllowedOrigin(origin: string, pattern: string) {
  if (origin === pattern) {
    return true
  }

  if (!pattern.includes('*.')) {
    return false
  }

  try {
    const originUrl = new URL(origin)
    const patternUrl = new URL(pattern.replace('*.', 'placeholder.'))
    const suffix = patternUrl.hostname.replace(/^placeholder\./, '')
    return originUrl.protocol === patternUrl.protocol && originUrl.hostname.endsWith(`.${suffix}`)
  } catch {
    return false
  }
}

// ── CORS ──────────────────────────────────────────────────────
// 默认放行 pages.dev 生产/预览地址和本地开发；设置页新增的自定义前端域名会写进数据库动态生效
app.use('*', async (c, next) => {
  const allowedOrigins = await getAllowedOriginPatterns(c.env)

  if (allowedOrigins.length === 0) {
    return cors()(c, next)
  }

  return cors({
    origin: (origin) => (allowedOrigins.some((pattern) => matchesAllowedOrigin(origin, pattern)) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next)
})

app.onError((error, c) => jsonError(c, error))

app.get('/', (c) => jsonSuccess(c, { ok: true, service: 'onlymail-worker' }))
app.get('/health', (c) => jsonSuccess(c, { ok: true }))

// ── /api/* — 管理后台会话认证 ─────────────────────────────────
// 无需会话的端点列表
const PUBLIC_API_PATHS = ['/api/init-status', '/api/init', '/api/login']

app.use('/api/*', async (c, next) => {
  if (PUBLIC_API_PATHS.includes(c.req.path)) {
    await next()
    return
  }

  const authHeader = c.req.header('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, '缺少登录凭证')
  }

  await verifyAdminSession(c.env, authHeader.slice('Bearer '.length).trim())
  await next()
})

app.route('/api', apiRoutes)

// ── /call/* — API Key 认证 ────────────────────────────────────
app.use('/call/*', async (c, next) => {
  const authHeader = c.req.header('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, '缺少 API Key')
  }

  const config = await getApiKeyConfig(c.env)
  if (!config.configured) {
    throw new AppError(503, 'API Key 尚未初始化，请先登录后台生成')
  }

  const isValid = await verifyApiKey(c.env, authHeader.slice('Bearer '.length).trim())
  if (!isValid) {
    throw new AppError(401, 'API Key 无效')
  }

  await next()
})

app.route('/call', callRoutes)

// ── Export ─────────────────────────────────────────────────────
const handler: ExportedHandler<AppBindings> = {
  fetch: app.fetch,
  email(message: ForwardableEmailMessage, env: AppBindings, ctx: ExecutionContext) {
    return handleEmail(message, env, ctx)
  },
  scheduled(controller: ScheduledController, env: AppBindings, _ctx: ExecutionContext) {
    return handleScheduled(controller, env)
  },
}

export default handler
