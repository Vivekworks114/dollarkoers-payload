/**
 * Fix WordPress / Turndown markdown that breaks Astro builds and rendering.
 *
 * - Indented lines (tabs / 4+ spaces) become `<pre>` code blocks in Markdown.
 * - Broken image link syntax is treated as a Vite import path.
 */

export interface SanitizeMarkdownOptions {
  /** When set, drops a leading `# title` that duplicates the post title. */
  title?: string
}

export function sanitizeMarkdownForAstro(md: string, options?: SanitizeMarkdownOptions): string {
  let out = normalizeWordPressMarkdownIndentation(md)
  out = fixMarkdownImages(out)
  if (options?.title) out = stripDuplicateTitleHeading(out, options.title)
  return out
}

function normalizeWordPressMarkdownIndentation(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inFence = false

  for (const rawLine of lines) {
    const trimmedEnd = rawLine.trimEnd()

    if (/^(`{3,}|~{3,})/.test(trimmedEnd.trimStart())) {
      inFence = !inFence
      out.push(trimmedEnd.trimStart())
      continue
    }

    if (inFence) {
      out.push(rawLine)
      continue
    }

    if (!trimmedEnd.trim()) {
      out.push('')
      continue
    }

    const content = trimmedEnd.replace(/^[\t ]+/, '')

    // WordPress empty heading blocks (`####` or `#### &nbsp;`)
    if (/^#{1,6}(\s+\u00a0|\s)*$/.test(content)) continue

    out.push(content)
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

function fixMarkdownImages(md: string): string {
  let out = md

  // ![alt]([label](url)) → ![alt](url)
  out = out.replace(
    /!\[([^\]]*)\]\(\[([^\]]+)\]\(([^)]+)\)\)/g,
    (_match, alt: string, _label: string, url: string) => `![${alt}](${url})`,
  )

  // [![alt](url)](url) → ![alt](url) when href and src are the same remote URL
  out = out.replace(
    /\[!\[([^\]]*)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/[^)]+)\)/gi,
    (_match, alt: string, imgUrl: string, linkUrl: string) =>
      imgUrl === linkUrl ? `![${alt}](${imgUrl})` : _match,
  )

  return out
}

function stripDuplicateTitleHeading(md: string, title: string): string {
  const want = title.trim().toLowerCase()
  if (!want) return md

  return md.replace(/^#\s+(.+?)\s*\n+/m, (block, heading: string) =>
    heading.trim().toLowerCase() === want ? '' : block,
  )
}
