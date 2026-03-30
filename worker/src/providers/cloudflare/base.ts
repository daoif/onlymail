/**
 * Cloudflare API 请求基础设施
 * 共用的 HTTP 请求方法、鉴权逻辑
 */

import { AppError } from '../../lib/http'
import type { CloudflareAuth } from '../types'

const BASE_URL = 'https://api.cloudflare.com/client/v4'

type Envelope<T> = {
  success: boolean
  result: T
  errors?: Array<{ code: number; message: string }>
  messages?: Array<{ code: number; message: string }>
}

export class CloudflareBase {
  constructor(protected readonly auth: CloudflareAuth) {}

  protected getTokenHeaders() {
    if (!this.auth.token) {
      throw new AppError(500, '缺少 CF_API_TOKEN，无法调用需要 Token 的 Cloudflare API')
    }

    return {
      Authorization: `Bearer ${this.auth.token}`,
    }
  }

  protected getGlobalHeaders() {
    if (!this.auth.authEmail || !this.auth.globalApiKey) {
      throw new AppError(500, '缺少 CF_EMAIL（或旧名字 CF_AUTH_EMAIL）或 CF_GLOBAL_API_KEY，无法调用 Cloudflare 全局鉴权接口')
    }

    return {
      'X-Auth-Email': this.auth.authEmail,
      'X-Auth-Key': this.auth.globalApiKey,
    }
  }

  protected async request<T>(path: string, init?: RequestInit, authMode: 'token' | 'global' = 'token') {
    const authHeaders = authMode === 'global' ? this.getGlobalHeaders() : this.getTokenHeaders()
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    const payload = (await response.json()) as Envelope<T>
    if (!response.ok || !payload.success) {
      throw new AppError(502, 'Cloudflare API 调用失败', payload.errors ?? payload.messages ?? payload)
    }

    return payload.result
  }
}

export function requireCloudflareAuth(auth: CloudflareAuth) {
  if (!auth.token && !(auth.authEmail && auth.globalApiKey)) {
    throw new AppError(500, '缺少 Cloudflare 鉴权配置，无法调用 Cloudflare API')
  }

  return auth
}
