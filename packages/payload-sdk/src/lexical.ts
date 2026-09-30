/**
 * Tiny, lossy Lexical-state -> Markdown serializer. Handles the node types
 * Payload's default Lexical config emits: paragraph, heading, list, list item,
 * link, text, line break, quote, code, horizontal rule, upload.
 *
 * For richer cases (custom blocks, embeds) extend this — but the WordPress
 * imports we plan to do use turndown to produce plain Markdown anyway, so
 * Payload's Lexical content for migrated docs starts as a single `paragraph`
 * containing pre-rendered Markdown text. This serializer round-trips that
 * faithfully.
 */

type Node = { type?: string; children?: Node[]; [key: string]: unknown }

export function lexicalToMarkdown(state: unknown): string {
  if (!state || typeof state !== 'object') return ''
  const root = ((state as { root?: Node }).root) ?? (state as Node)
  return walk(root, 0).trim() + '\n'
}

function walk(node: Node, depth: number): string {
  if (!node) return ''
  const children = node.children ?? []

  switch (node.type) {
    case 'root':
      return children.map((c) => walk(c, depth)).join('\n\n')

    case 'paragraph':
      return children.map((c) => walk(c, depth)).join('')

    case 'heading': {
      const tag = String(node.tag ?? 'h2')
      const level = Math.max(1, Math.min(6, Number(tag.replace('h', '')) || 2))
      const text = children.map((c) => walk(c, depth)).join('')
      return `${'#'.repeat(level)} ${text}`
    }

    case 'quote': {
      const text = children.map((c) => walk(c, depth)).join('\n').trim()
      return text.split('\n').map((l) => `> ${l}`).join('\n')
    }

    case 'list': {
      const ordered = node.listType === 'number'
      return children
        .map((c, i) => {
          const marker = ordered ? `${i + 1}.` : '-'
          const text = walk(c, depth + 1)
          return `${'  '.repeat(depth)}${marker} ${text}`
        })
        .join('\n')
    }

    case 'listitem':
      return children.map((c) => walk(c, depth)).join('')

    case 'link': {
      const text = children.map((c) => walk(c, depth)).join('')
      const fields = (node.fields ?? {}) as { url?: string; newTab?: boolean }
      return `[${text}](${fields.url ?? '#'})`
    }

    case 'horizontalrule':
      return '---'

    case 'code':
      return '```\n' + children.map((c) => walk(c, depth)).join('') + '\n```'

    case 'linebreak':
      return '  \n'

    case 'upload': {
      const value = (node as { value?: { url?: string; alt?: string } }).value
      if (value?.url) return `![${value.alt ?? ''}](${value.url})`
      return ''
    }

    case 'text': {
      let text = String((node as { text?: string }).text ?? '')
      const fmt = Number((node as { format?: number }).format ?? 0)
      // Lexical's bitmask: bold=1, italic=2, strikethrough=4, underline=8, code=16
      if (fmt & 16) text = `\`${text}\``
      if (fmt & 4) text = `~~${text}~~`
      if (fmt & 2) text = `*${text}*`
      if (fmt & 1) text = `**${text}**`
      return text
    }

    default:
      return children.map((c) => walk(c, depth)).join('')
  }
}
