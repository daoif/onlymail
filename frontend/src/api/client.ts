const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const TOKEN_KEY = 'mails_admin_token'
const USERNAME_KEY = 'mails_admin_user'

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function clearAdminSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && window.location.pathname !== '/login') {
      clearAdminSession()
      window.location.href = '/login'
    }

    const message = payload?.error?.message ?? '请求失败'
    throw new ApiError(message, response.status, payload?.error?.details ?? null)
  }

  return payload as T
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers ?? {})
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  return parseResponse<T>(response)
}
