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
  return `onlymail_${suffix}`
}

export function getApiKeyPreview(apiKey: string) {
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}

export function generateAdminSessionToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const suffix = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `onlymail_session_${suffix}`
}
