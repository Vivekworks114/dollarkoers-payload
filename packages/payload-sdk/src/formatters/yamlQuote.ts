/**
 * Quote YAML scalars that must stay strings (esp. numeric `slug` values).
 *
 * Do NOT quote `true`/`false` — Astro schemas often use `z.boolean()` for
 * fields like `draft`, and `"false"` would fail as a string.
 */
export function quoteYamlScalar(s: string): string {
  const needsQuotes =
    s === '' ||
    /^(null|~|yes|no|on|off)$/i.test(s) ||
    /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s) ||
    /^\d{4}-\d{2}-\d{2}/.test(s) ||
    !/^[\w\d:./@-]+$/.test(s)

  if (!needsQuotes) return s
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
