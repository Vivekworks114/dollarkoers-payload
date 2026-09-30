/**
 * Minimal YAML frontmatter parser for blog .md / .mdx (sync merge from repo files).
 */
export function parseYamlFrontmatter(raw: string): {
  data: Record<string, unknown>
  body: string
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match?.[1] || match[2] === undefined) return { data: {}, body: raw.trim() }

  const data: Record<string, unknown> = {}
  const block = match[1]
  const body = match[2].trim()
  let currentList: string | null = null

  for (const line of block.split('\n')) {
    const listItem = line.match(/^\s+-\s+(.+)$/)
    if (listItem?.[1] && currentList) {
      const arr = (data[currentList] as string[]) ?? []
      arr.push(stripQuotes(listItem[1]))
      data[currentList] = arr
      continue
    }
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (!kv?.[1]) continue
    const key = kv[1]
    const value = kv[2] ?? ''
    if (value === '') {
      currentList = key
      data[key] = []
      continue
    }
    currentList = null
    data[key] = stripQuotes(value)
  }

  return { data, body }
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '')
}
