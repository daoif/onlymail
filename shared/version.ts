export function normalizeVersion(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const normalized = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed
  return /^\d+\.\d+\.\d+$/.test(normalized) ? normalized : null
}

export function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)

  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (diff !== 0) {
      return diff
    }
  }

  return 0
}
