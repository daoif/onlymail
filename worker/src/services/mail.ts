import PostalMime from 'postal-mime'

import type { AppBindings, MailDetail, MailSummary, PageParams } from '../types'

import { exec, many, one } from '../lib/db'

function toTextAddress(sender: unknown) {
  if (!sender) return 'unknown'
  if (typeof sender === 'string') return sender
  if (typeof sender === 'object' && sender !== null && 'address' in sender) {
    const address = Reflect.get(sender, 'address')
    const name = Reflect.get(sender, 'name')
    return typeof name === 'string' && name ? `${name} <${String(address)}>` : String(address)
  }

  return String(sender)
}

export async function saveIncomingMail(env: AppBindings, address: string, message: ForwardableEmailMessage) {
  const raw = await new Response(message.raw).text()
  const parser = new PostalMime()
  const parsed = await parser.parse(raw)
  const source = toTextAddress(parsed.from ?? message.from)
  const subject = parsed.subject?.trim() ?? ''
  const text = parsed.text?.trim() ?? ''
  const html = typeof parsed.html === 'string' ? parsed.html : ''

  await exec(
    env.DB.prepare(
      `INSERT INTO raw_mails (address, source, subject, message_id, raw, text, html)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(address, source, subject, parsed.messageId ?? message.headers.get('message-id') ?? null, raw, text, html),
  )
}

export async function listMailsForAddress(env: AppBindings, address: string, pageParams: PageParams) {
  const normalized = address.trim().toLowerCase()
  const items = await many<MailSummary>(
    env.DB.prepare(
      `SELECT id, address, source, subject, created_at
       FROM raw_mails
       WHERE address = ?1
       ORDER BY created_at DESC
       LIMIT ?2 OFFSET ?3`,
    ).bind(normalized, pageParams.size, pageParams.offset),
  )

  const countRow = await one<{ total: number }>(
    env.DB.prepare('SELECT COUNT(*) AS total FROM raw_mails WHERE address = ?1').bind(normalized),
  )

  return {
    items,
    total: countRow?.total ?? 0,
  }
}

export async function listMails(env: AppBindings, pageParams: PageParams, address?: string) {
  const where = address ? 'WHERE address = ?1' : ''
  const bindings = address ? [address.trim().toLowerCase(), pageParams.size, pageParams.offset] : [pageParams.size, pageParams.offset]
  const countBindings = address ? [address.trim().toLowerCase()] : []
  const limitIndex = address ? 2 : 1
  const offsetIndex = address ? 3 : 2

  const items = await many<MailSummary>(
    env.DB.prepare(
      `SELECT id, address, source, subject, created_at
       FROM raw_mails
       ${where}
       ORDER BY created_at DESC
       LIMIT ?${limitIndex} OFFSET ?${offsetIndex}`,
    ).bind(...bindings),
  )

  const countRow = await one<{ total: number }>(
    env.DB.prepare(`SELECT COUNT(*) AS total FROM raw_mails ${where}`).bind(...countBindings),
  )

  return {
    items,
    total: countRow?.total ?? 0,
  }
}

export async function getMailById(env: AppBindings, id: number) {
  return one<MailDetail>(
    env.DB.prepare(
      `SELECT id, address, source, subject, message_id, raw, text, html, created_at
       FROM raw_mails
       WHERE id = ?1`,
    ).bind(id),
  )
}

export async function deleteMail(env: AppBindings, id: number) {
  const result = await exec(env.DB.prepare('DELETE FROM raw_mails WHERE id = ?1').bind(id))
  return result.meta.changes > 0
}
