/**
 * Provider 层入口 — 工厂函数
 *
 * Service 层通过 createProviders(env) 获取 Provider 实例。
 * 当前只有 Cloudflare 实现，后续可按需添加其他 Provider。
 */

import type { AppBindings } from '../types'
import type { Providers } from './types'
import { createCloudflareProviders } from './cloudflare/index'

export function createProviders(env: AppBindings): Providers {
  return createCloudflareProviders({
    token: env.CF_API_TOKEN,
    authEmail: env.CF_AUTH_EMAIL || env.CF_EMAIL,
    globalApiKey: env.CF_GLOBAL_API_KEY,
  })
}

export type { Providers, DnsProvider, EmailProvider, CloudflareAuth } from './types'
