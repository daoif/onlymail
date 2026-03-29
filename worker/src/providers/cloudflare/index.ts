/**
 * Cloudflare Provider 工厂
 */

import type { CloudflareAuth, Providers } from '../types'
import { requireCloudflareAuth } from './base'
import { CloudflareDnsProvider } from './dns'
 import { CloudflareDomainBindingProvider } from './domain-binding'
import { CloudflareEmailProvider } from './email'

export function createCloudflareProviders(auth: CloudflareAuth): Providers {
  const validated = requireCloudflareAuth(auth)
  return {
    dns: new CloudflareDnsProvider(validated),
    email: new CloudflareEmailProvider(validated),
    domainBinding: new CloudflareDomainBindingProvider(validated),
  }
}
