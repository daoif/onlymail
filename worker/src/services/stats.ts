import type { AppBindings, DashboardStats } from '../types'

import { one } from '../lib/db'

export async function getDashboardStats(env: AppBindings): Promise<DashboardStats> {
  const [addressRow, mailRow, domainRow, todayMailRow] = await Promise.all([
    one<{ total: number }>(env.DB.prepare('SELECT COUNT(*) AS total FROM address')),
    one<{ total: number }>(env.DB.prepare('SELECT COUNT(*) AS total FROM raw_mails')),
    one<{ total: number }>(env.DB.prepare('SELECT COUNT(*) AS total FROM domains')),
    one<{ total: number }>(
      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM raw_mails
         WHERE date(created_at) = date('now')`,
      ),
    ),
  ])

  return {
    totalAddresses: addressRow?.total ?? 0,
    totalMails: mailRow?.total ?? 0,
    totalDomains: domainRow?.total ?? 0,
    todayMailCount: todayMailRow?.total ?? 0,
  }
}
