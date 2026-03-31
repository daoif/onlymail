export function extractDatabaseIdFromCreateOutput(output: string) {
  const patterns = [
    /database_id\s*=\s*"([^"]+)"/i,
    /"database_id"\s*:\s*"([^"]+)"/i,
  ]

  for (const pattern of patterns) {
    const match = output.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return ''
}
