/**
 * Serialize Payload REST `where` objects into query-string form.
 * Used by PayloadClient.findAll — exported for tests and debugging.
 */
export function buildWhereSearchParams(where: Record<string, unknown>): URLSearchParams {
  const out = new URLSearchParams()
  flattenWhere(where, '', out)
  return out
}

function flattenWhere(where: Record<string, unknown>, prefix: string, out: URLSearchParams): void {
  for (const [key, value] of Object.entries(where)) {
    const nextKey = prefix ? `${prefix}[${key}]` : `where[${key}]`
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenWhere(value as Record<string, unknown>, nextKey, out)
    } else if (Array.isArray(value)) {
      value.forEach((v, index) => {
        const indexedKey = `${nextKey}[${index}]`
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          flattenWhere(v as Record<string, unknown>, indexedKey, out)
        } else if (v !== undefined && v !== null) {
          out.append(indexedKey, String(v))
        }
      })
    } else if (value !== undefined && value !== null) {
      out.set(nextKey, String(value))
    }
  }
}

/** Copy all entries from `source` into `target` (used to add `where` to paginated queries). */
export function mergeSearchParams(target: URLSearchParams, source: URLSearchParams): void {
  for (const [key, value] of source.entries()) {
    target.append(key, value)
  }
}
