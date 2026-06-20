type WranglerJsonValue = unknown
type WranglerResultRow = Record<string, unknown>

function getClosingBracket(opening: string) {
  return opening === '[' ? ']' : '}'
}

function findBalancedJsonEnd(value: string, start: number) {
  const stack = [getClosingBracket(value[start])]
  let inString = false
  let escaped = false

  for (let index = start + 1; index < value.length; index += 1) {
    const char = value[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '[' || char === '{') {
      stack.push(getClosingBracket(char))
      continue
    }

    if (char === ']' || char === '}') {
      const expected = stack.pop()
      if (char !== expected) {
        return -1
      }

      if (stack.length === 0) {
        return index + 1
      }
    }
  }

  return -1
}

function parseWranglerJsonPayload(output: string): WranglerJsonValue {
  const trimmed = output.trim()
  if (!trimmed) {
    throw new Error('Wrangler JSON 输出为空')
  }

  try {
    return JSON.parse(trimmed) as WranglerJsonValue
  } catch {
    // Wrangler may print advisory text before --json output, for example when
    // proxy environment variables are detected.
  }

  for (let index = 0; index < output.length; index += 1) {
    if (output[index] !== '[' && output[index] !== '{') {
      continue
    }

    const end = findBalancedJsonEnd(output, index)
    if (end === -1) {
      continue
    }

    try {
      return JSON.parse(output.slice(index, end)) as WranglerJsonValue
    } catch {
      // Keep looking; earlier brackets may belong to non-JSON diagnostic text.
    }
  }

  throw new Error('无法解析 Wrangler JSON 输出')
}

export function parseWranglerJsonRows(output: string) {
  const payload = parseWranglerJsonPayload(output)
  if (!Array.isArray(payload)) {
    throw new Error('Wrangler JSON 输出不是数组')
  }

  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || !('results' in entry)) {
      return [] as WranglerResultRow[]
    }

    const results = (entry as { results?: unknown }).results
    return Array.isArray(results) ? results.filter((row): row is WranglerResultRow => Boolean(row) && typeof row === 'object') : []
  })
}

