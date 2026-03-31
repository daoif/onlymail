export const DEFAULT_WORKER_NAME = 'mails-worker'
export const DEFAULT_PAGES_PROJECT = 'mails-frontend'
export const DEFAULT_DEV_ALLOWED_ORIGIN = 'http://localhost:5173'

export function buildPagesDefaultOrigins(projectSubdomain: string) {
  return [
    `https://${projectSubdomain}`,
    `https://*.${projectSubdomain}`,
  ]
}
