import { MailsApiClient, type MailDetail } from './client.js'
import { TimeoutError } from './errors.js'

export class MailsClient extends MailsApiClient {
  async waitForMail(address: string, timeoutMs = 60_000, intervalMs = 3_000): Promise<MailDetail> {
    const start = Date.now()
    const initial = await this.getMailList(address, 1, 50)
    const knownIds = new Set(initial.items.map((item) => item.id))

    while (Date.now() - start < timeoutMs) {
      const current = await this.getMailList(address, 1, 50)
      const nextMail = current.items.find((item) => !knownIds.has(item.id)) ?? null

      if (nextMail) {
        return this.getMail(nextMail.id)
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new TimeoutError(`等待 ${address} 的新邮件超时`)
  }
}

export * from './client.js'
export * from './errors.js'
