import { sign, verify } from 'hono/jwt'

import { AppError } from './http'

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return toHex(digest)
}

export function generateApiKey() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const suffix = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `mails_${suffix}`
}

export function getApiKeyPreview(apiKey: string) {
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}

export async function createAdminToken(username: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  return sign(
    {
      sub: username,
      role: 'admin',
      iat: now,
      exp: now + 60 * 60 * 12,
    },
    secret,
  )
}

export async function verifyAdminToken(token: string, secret: string) {
  try {
    return await verify(token, secret, 'HS256')
  } catch {
    throw new AppError(401, '登录已失效，请重新登录')
  }
}
