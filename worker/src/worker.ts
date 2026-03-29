import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { AppBindings, AppEnv } from './types'

import { verifyAdminToken } from './lib/crypto'
import { AppError, jsonError, jsonSuccess } from './lib/http'
import { handleEmail } from './email'
import { apiRoutes } from './routes/api'
import { callRoutes } from './routes/call'
import { handleScheduled } from './scheduled'
import { getApiKeyConfig, verifyApiKey } from './services/settings'

const app = new Hono<AppEnv>()

// ── CORS ──────────────────────────────────────────────────────
// 限制为前端域名 + 本地开发，通过 ALLOWED_ORIGINS 环境变量配置
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS
    ? c.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : []

  // 开发环境或未配置时放开
  if (allowedOrigins.length === 0) {
    return cors()(c, next)
  }

  return cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next)
})

app.onError((error, c) => jsonError(c, error))

app.get('/', (c) => jsonSuccess(c, { ok: true, service: 'mails-worker' }))
app.get('/health', (c) => jsonSuccess(c, { ok: true }))

// ── /api/* — JWT 认证 ─────────────────────────────────────────
// 无需 JWT 的端点列表
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

  await verifyAdminToken(authHeader.slice('Bearer '.length).trim(), c.env.JWT_SECRET)
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
