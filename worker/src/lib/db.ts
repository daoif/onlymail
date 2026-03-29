import type { D1Result } from '@cloudflare/workers-types'

export async function one<T>(statement: D1PreparedStatement): Promise<T | null> {
  const result = await statement.first<T>()
  return result ?? null
}

export async function many<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>()
  return result.results ?? []
}

export async function exec(statement: D1PreparedStatement): Promise<D1Result> {
  return statement.run()
}
