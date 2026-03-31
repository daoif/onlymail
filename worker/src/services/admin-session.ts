import type { AppBindings } from '../types'

import { exec, one } from '../lib/db'
import { generateAdminSessionToken, sha256 } from '../lib/crypto'
import { AppError } from '../lib/http'

const ADMIN_SESSION_TTL_DAYS = 30

type AdminSessionRow = {
  id: number
  username: string
  expires_at: string
  revoked_at: string | null
}

function buildExpiryIso() {
  return new Date(Date.now() + ADMIN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export async function createAdminSession(env: AppBindings, username: string) {
  const token = generateAdminSessionToken()
  const tokenHash = await sha256(token)
  const expiresAt = buildExpiryIso()

  await exec(
    env.DB.prepare(
      `INSERT INTO admin_sessions (token_hash, username, expires_at)
       VALUES (?1, ?2, ?3)`,
    ).bind(tokenHash, username, expiresAt),
  )

  return {
    token,
    username,
    expiresAt,
  }
}

export async function verifyAdminSession(env: AppBindings, token: string) {
  const tokenHash = await sha256(token)
  const session = await one<AdminSessionRow>(
    env.DB.prepare(
      `SELECT id, username, expires_at, revoked_at
       FROM admin_sessions
       WHERE token_hash = ?1`,
    ).bind(tokenHash),
  )

  if (!session || session.revoked_at) {
    throw new AppError(401, '登录已失效，请重新登录')
  }

  if (Date.parse(session.expires_at) <= Date.now()) {
    throw new AppError(401, '登录已失效，请重新登录')
  }

  await exec(
    env.DB.prepare(
      `UPDATE admin_sessions
       SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?1`,
    ).bind(session.id),
  )

  return {
    username: session.username,
    expiresAt: session.expires_at,
  }
}

export async function revokeAdminSession(env: AppBindings, token: string) {
  const tokenHash = await sha256(token)
  await exec(
    env.DB.prepare(
      `UPDATE admin_sessions
       SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE token_hash = ?1 AND revoked_at IS NULL`,
    ).bind(tokenHash),
  )
}

export async function revokeAllAdminSessions(env: AppBindings) {
  await exec(
    env.DB.prepare(
      `UPDATE admin_sessions
       SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE revoked_at IS NULL`,
    ),
  )
}

export async function cleanupExpiredAdminSessions(env: AppBindings) {
  await exec(
    env.DB.prepare(
      `DELETE FROM admin_sessions
       WHERE revoked_at IS NOT NULL
          OR expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ),
  )
}
