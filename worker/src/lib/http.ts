import type { Context } from 'hono'
import { ZodError } from 'zod'

export class AppError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.details = details
  }
}

function createJsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
    },
  })
}

export function jsonSuccess<T>(_c: Context, data: T, status = 200) {
  return createJsonResponse({ data }, status)
}

export function jsonMessage(_c: Context, message: string, status = 200) {
  return createJsonResponse({ message }, status)
}

export function jsonError(_c: Context, error: unknown) {
  if (error instanceof AppError) {
    return createJsonResponse(
      {
        error: {
          message: error.message,
          details: error.details ?? null,
        },
      },
      error.status,
    )
  }

  if (error instanceof ZodError) {
    return createJsonResponse(
      {
        error: {
          message: '请求参数错误',
          details: error.errors,
        },
      },
      400,
    )
  }

  console.error(error)
  const msg = error instanceof Error ? error.message : '服务器内部错误'
  return createJsonResponse(
    {
      error: {
        message: msg,
      },
    },
    500,
  )
}
