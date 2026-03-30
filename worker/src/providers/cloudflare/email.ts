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
    const init = {
      method: 'POST',
      body: JSON.stringify(payload),
    } satisfies RequestInit

    try {
      return await this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules`, init)
    } catch (error) {
      if (!this.shouldRetryWithGlobalAuth(error)) {
        throw error
      }

      return this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules`, init, 'global')
    }
  }

  async deleteEmailRule(zoneId: string, ruleId: string) {
    const init = {
      method: 'DELETE',
    } satisfies RequestInit

    try {
      return await this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules/${ruleId}`, init)
    } catch (error) {
      if (!this.shouldRetryWithGlobalAuth(error)) {
        throw error
      }

      return this.request<EmailRule>(`/zones/${zoneId}/email/routing/rules/${ruleId}`, init, 'global')
    }
  }
}
