/**
 * Cloudflare Email Routing Provider 实现
 */

import type { EmailProvider, EmailRoutingSettings, EmailRule } from '../types'
import { CloudflareBase } from './base'

export class CloudflareEmailProvider extends CloudflareBase implements EmailProvider {
  async getEmailRoutingSettings(zoneId: string) {
    try {
      return await this.request<EmailRoutingSettings>(`/zones/${zoneId}/email/routing`)
    } catch (error) {
      if (!this.shouldRetryWithGlobalAuth(error)) {
        throw error
      }

      return this.request<EmailRoutingSettings>(`/zones/${zoneId}/email/routing`, undefined, 'global')
    }
  }

  async enableEmailRouting(zoneId: string) {
    const init = {
      method: 'POST',
      body: JSON.stringify({}),
    } satisfies RequestInit

    try {
      return await this.request<EmailRoutingSettings>(`/zones/${zoneId}/email/routing/enable`, init)
    } catch (error) {
      if (!this.shouldRetryWithGlobalAuth(error)) {
        throw error
      }

      return this.request<EmailRoutingSettings>(`/zones/${zoneId}/email/routing/enable`, init, 'global')
    }
  }

  async createEmailRule(zoneId: string, payload: Record<string, unknown>) {
    return this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async deleteEmailRule(zoneId: string, ruleId: string) {
    return this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules/${ruleId}`, {
      method: 'DELETE',
    })
  }
}
