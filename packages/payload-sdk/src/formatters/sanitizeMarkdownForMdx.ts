/**
 * Extra sanitization when synced blog files use the `.mdx` extension.
 * MDX parses `<` as JSX — WordPress HTML comments and broken tags break the build.
 */

import {
  sanitizeMarkdownForAstro,
  type SanitizeMarkdownOptions,
} from './sanitizeMarkdownForAstro'

export function sanitizeMarkdownForMdx(md: string, options?: SanitizeMarkdownOptions): string {
  let out = sanitizeMarkdownForAstro(md, options)
  out = mapOutsideCodeFences(out, (chunk) => {
    let text = stripHtmlComments(chunk)
    text = stripDoctype(text)
    text = escapeStrayLessThan(text)
    return text
  })
  return out
}

function mapOutsideCodeFences(md: string, fn: (chunk: string) => string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inFence = false
  let chunk: string[] = []

  const flush = () => {
    if (chunk.length === 0) return
    out.push(fn(chunk.join('\n')))
    chunk = []
  }

  for (const line of lines) {
    const fence = line.trimStart()
    if (/^(`{3,}|~{3,})/.test(fence)) {
      flush()
      out.push(line)
      inFence = !inFence
      continue
    }

    if (inFence) {
      out.push(line)
      continue
    }

    chunk.push(line)
  }

  flush()
  return out.join('\n')
}

function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}

function stripDoctype(text: string): string {
  return text.replace(/<!DOCTYPE[^>]*>/gi, '')
}

/** Escape `<` that does not start a valid HTML/JSX tag (common in WP imports). */
function escapeStrayLessThan(text: string): string {
  let out = ''
  let i = 0

  while (i < text.length) {
    if (text[i] !== '<') {
      out += text[i]
      i += 1
      continue
    }

    const rest = text.slice(i)
    const tagMatch = rest.match(/^<\/?[A-Za-z][\w:-]*(?:\s[^<>]*?)?\/?>/)
    if (tagMatch) {
      out += tagMatch[0]
      i += tagMatch[0].length
      continue
    }

    out += '&lt;'
    i += 1
  }

  return out
}
