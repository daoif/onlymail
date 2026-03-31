/**
 * Cloudflare Email Routing Provider 实现
 */

import type { EmailProvider, EmailRoutingSettings, EmailRule } from '../types'
import { CloudflareBase } from './base'

export class CloudflareEmailProvider extends CloudflareBase implements EmailProvider {
  async getEmailRoutingSettings(zoneId: string) {
    return this.request<EmailRoutingSettings>(`/zones/${zoneId}/email/routing`, undefined, 'global')
  }

  async enableEmailRouting(zoneId: string) {
    const init = {
      method: 'POST',
      body: JSON.stringify({}),
    } satisfies RequestInit

    return this.request<EmailRoutingSettings>(`/zones/${zoneId}/email/routing/enable`, init, 'global')
  }

  async updateCatchAll(zoneId: string, workerName: string) {
    const init = {
      method: 'PUT',
      body: JSON.stringify({
        enabled: true,
        matchers: [{ type: 'all' }],
        actions: [{ type: 'worker', value: [workerName] }],
      }),
    } satisfies RequestInit

    return this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules/catch_all`, init, 'global')
  }

  async listEmailRules(zoneId: string) {
    return this.request<EmailRule[]>(`/zones/${zoneId}/email/routing/rules`, undefined, 'global')
  }

  async createEmailRule(zoneId: string, payload: Record<string, unknown>) {
    const init = {
      method: 'POST',
      body: JSON.stringify(payload),
    } satisfies RequestInit

    return this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules`, init, 'global')
  }

  async deleteEmailRule(zoneId: string, ruleId: string) {
    const init = {
      method: 'DELETE',
    } satisfies RequestInit

    return this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules/${ruleId}`, init, 'global')
  }
}
