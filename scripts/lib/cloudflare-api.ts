type AuthMode = 'token' | 'global'

type CloudflareEnvelope<T> = {
  success: boolean
  result: T
  errors?: Array<{ code: number; message: string }>
  messages?: Array<{ code: number; message: string }>
}

type ZoneResult = {
  id: string
  name: string
}

type WorkerDomain = {
  id: string
  hostname: string
  service: string
}

type WorkersSubdomain = {
  subdomain: string
}

type WorkerSubdomainState = {
  enabled: boolean
  previews_enabled: boolean
}

type PagesProject = {
  name: string
  subdomain: string
}

type PagesDomain = {
  name: string
}

type D1Database = {
  uuid: string
  name: string
}

type DnsRecord = {
  id: string
  type: string
  name: string
  content: string
  proxied?: boolean
}

type CloudflareApiOptions = {
  token?: string
  authEmail?: string
  globalApiKey?: string
}

const BASE_URL = 'https://api.cloudflare.com/client/v4'
const RETRY_DELAYS_MS = [0, 1_000, 2_500]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class CloudflareApiClient {
  constructor(private readonly options: CloudflareApiOptions) {}

  private async fetchEnvelope<T>(mode: AuthMode, path: string, init?: RequestInit) {
    let lastError: unknown = null

    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) {
        await sleep(delay)
      }

      try {
        const response = await fetch(`${BASE_URL}${path}`, {
          ...init,
          headers: {
            ...this.getHeaders(mode),
            ...(init?.headers ?? {}),
          },
        })

        const payload = (await response.json()) as CloudflareEnvelope<T>
        return { response, payload }
      } catch (error) {
        lastError = error
      }
    }

    throw lastError
  }

  private getHeaders(mode: AuthMode) {
    if (mode === 'token') {
      if (!this.options.token) {
        throw new Error('缺少 CF_API_TOKEN，无法调用 Cloudflare Token API')
      }

      return {
        Authorization: `Bearer ${this.options.token}`,
        'Content-Type': 'application/json',
      }
    }

    if (!this.options.authEmail || !this.options.globalApiKey) {
      throw new Error('缺少 CF_EMAIL（或 CF_AUTH_EMAIL）或 CF_GLOBAL_API_KEY，无法调用 Cloudflare 全局鉴权 API')
    }

    return {
      'X-Auth-Email': this.options.authEmail,
      'X-Auth-Key': this.options.globalApiKey,
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(mode: AuthMode, path: string, init?: RequestInit) {
    const { response, payload } = await this.fetchEnvelope<T>(mode, path, init)
    if (!response.ok || !payload.success) {
      const message = payload.errors?.[0]?.message || payload.messages?.[0]?.message || `Cloudflare API 调用失败: ${path}`
      throw new Error(message)
    }

    return payload.result
  }

  async getZone(zoneId: string) {
    return this.request<ZoneResult>('token', `/zones/${zoneId}`)
  }

  async listWorkerDomains(accountId: string) {
    return this.request<WorkerDomain[]>('token', `/accounts/${accountId}/workers/domains`)
  }

  async getWorkersSubdomain(accountId: string) {
    return this.request<WorkersSubdomain>('token', `/accounts/${accountId}/workers/subdomain`)
  }

  async ensureWorkerSubdomain(accountId: string, scriptName: string) {
    const existing = await this.request<WorkerSubdomainState>('token', `/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`)
    if (existing.enabled) {
      return existing
    }

    return this.request<WorkerSubdomainState>('token', `/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    })
  }

  async ensureWorkerDomain(accountId: string, zoneId: string, hostname: string, service: string) {
    const existing = await this.listWorkerDomains(accountId)
    const found = existing.find((item) => item.hostname === hostname)
    if (found && found.service === service) {
      return found
    }

    return this.request<WorkerDomain>('token', `/accounts/${accountId}/workers/domains`, {
      method: 'PUT',
      body: JSON.stringify({
        hostname,
        zone_id: zoneId,
        service,
        environment: 'production',
      }),
    })
  }

  async getPagesProject(accountId: string, projectName: string) {
    const { response, payload } = await this.fetchEnvelope<PagesProject>('token', `/accounts/${accountId}/pages/projects/${projectName}`)
    if (response.status === 404) {
      return null
    }

    if (!response.ok || !payload.success) {
      const message = payload.errors?.[0]?.message || payload.messages?.[0]?.message || `Cloudflare API 调用失败: /accounts/${accountId}/pages/projects/${projectName}`
      throw new Error(message)
    }

    return payload.result
  }

  async ensurePagesProject(accountId: string, projectName: string, productionBranch: string) {
    const existing = await this.getPagesProject(accountId, projectName)
    if (existing) {
      return existing
    }

    return this.request<PagesProject>('token', `/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      body: JSON.stringify({
        name: projectName,
        production_branch: productionBranch,
      }),
    })
  }

  async listPagesDomains(accountId: string, projectName: string) {
    return this.request<PagesDomain[]>('token', `/accounts/${accountId}/pages/projects/${projectName}/domains`)
  }

  async listD1Databases(accountId: string) {
    return this.request<D1Database[]>('token', `/accounts/${accountId}/d1/database`)
  }

  async getD1DatabaseByName(accountId: string, databaseName: string) {
    const databases = await this.listD1Databases(accountId)
    return databases.find((item) => item.name === databaseName) ?? null
  }

  async addPagesDomain(accountId: string, projectName: string, domain: string) {
    return this.request<PagesDomain>('token', `/accounts/${accountId}/pages/projects/${projectName}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: domain }),
    })
  }

  async retryPagesDomain(accountId: string, projectName: string, domain: string) {
    return this.request<PagesDomain>('token', `/accounts/${accountId}/pages/projects/${projectName}/domains/${domain}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
  }

  async listDnsRecords(zoneId: string, params?: URLSearchParams) {
    const suffix = params && params.toString() ? `?${params.toString()}` : ''
    return this.request<DnsRecord[]>('token', `/zones/${zoneId}/dns_records${suffix}`)
  }

  async ensureCname(zoneId: string, fqdn: string, target: string) {
    const params = new URLSearchParams({ type: 'CNAME', name: fqdn })
    const existing = await this.listDnsRecords(zoneId, params)
    const record = existing[0]
    if (!record) {
      return this.request<DnsRecord>('token', `/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'CNAME',
          name: fqdn,
          content: target,
          proxied: false,
        }),
      })
    }

    if (record.content === target && record.proxied === false) {
      return record
    }

    return this.request<DnsRecord>('token', `/zones/${zoneId}/dns_records/${record.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        type: 'CNAME',
        name: fqdn,
        content: target,
        proxied: false,
      }),
    })
  }

  async enableEmailRouting(zoneId: string) {
    return this.request('global', `/zones/${zoneId}/email/routing/enable`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async updateCatchAll(zoneId: string, workerName: string) {
    return this.request('global', `/zones/${zoneId}/email/routing/rules/catch_all`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: true,
        matchers: [{ type: 'all' }],
        actions: [{ type: 'worker', value: [workerName] }],
      }),
    })
  }
}
