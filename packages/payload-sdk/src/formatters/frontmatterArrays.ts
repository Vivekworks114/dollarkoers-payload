/** Frontmatter keys that Astro content schemas typically define as string arrays. */
export const FRONTMATTER_STRING_ARRAY_KEYS = new Set([
  'cssLinks',
  'jsLinks',
  'stylesheets',
  'scripts',
])

/** Coerce WP / Payload extra values into a YAML string array for Astro schemas. */
export function coerceFrontmatterStringArray(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean)
    return items.length > 0 ? items : undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    if (trimmed.includes(',')) {
      const items = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
      return items.length > 0 ? items : undefined
    }
    return [trimmed]
  }
  return undefined
}

export function normalizeFrontmatterArrayFields(
  obj: Record<string, unknown>,
  keys: ReadonlySet<string> = FRONTMATTER_STRING_ARRAY_KEYS,
): void {
  for (const key of keys) {
    if (!(key in obj)) continue
    const coerced = coerceFrontmatterStringArray(obj[key])
    if (coerced) obj[key] = coerced
    else delete obj[key]
  }
}
