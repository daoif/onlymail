import type { Context } from 'hono'

import type { PageParams } from '../types'

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getPageParams(c: Context, defaultSize = 20, maxSize = 100): PageParams {
  const page = toPositiveInt(c.req.query('page'), 1)
  const requestedSize = toPositiveInt(c.req.query('size'), defaultSize)
  const size = Math.min(requestedSize, maxSize)

  return {
    page,
    size,
    offset: (page - 1) * size,
  }
}

export function toPagination(total: number, pageParams: PageParams) {
  return {
    page: pageParams.page,
    size: pageParams.size,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageParams.size)),
  }
}
