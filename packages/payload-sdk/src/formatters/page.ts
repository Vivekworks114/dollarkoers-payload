import { lexicalToMarkdown } from '../lexical'
import type { FormattedFile } from './blog'

interface PageDoc {
  id: string
  title: string
  slug: string
  description?: string | null
  pubDate?: string | null
  updatedDate?: string | null
  content: unknown
}

export function formatPageMarkdown(doc: PageDoc): FormattedFile {
  const frontmatter: Record<string, unknown> = { title: doc.title }
  if (doc.description) frontmatter.description = doc.description
  if (doc.pubDate) frontmatter.pubDate = doc.pubDate
  if (doc.updatedDate) frontmatter.updatedDate = doc.updatedDate

  const yamlLines: string[] = []
  for (const [k, v] of Object.entries(frontmatter)) {
    yamlLines.push(`${k}: ${typeof v === 'string' && /[:#]/.test(v) ? JSON.stringify(v) : v}`)
  }
  return {
    filename: `${doc.slug}.md`,
    body: `---\n${yamlLines.join('\n')}\n---\n\n${lexicalToMarkdown(doc.content)}`,
  }
}
