/**
 * URL- and filesystem-safe blog slug for Payload, markdown filenames, and Astro routes.
 *
 * - lowercase
 * - spaces / underscores → hyphens
 * - accents removed (é → e)
 * - other special characters → hyphens (then collapsed)
 *
 * Idempotent: already-clean slugs pass through unchanged (safe on re-sync / re-save).
 */
export function sanitizeBlogSlug(raw: string): string {
  if (!raw) return ''

  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Slug used when syncing to Astro. Always prefers the Payload `slug` field so live
 * URLs stay stable; falls back to title only when slug is missing (new/corrupt rows).
 */
export function resolveBlogSlug(
  slug: string | null | undefined,
  title: string,
  docId?: string | number,
): string {
  const raw = (typeof slug === 'string' && slug.trim()) || title.trim()
  const normalized = sanitizeBlogSlug(raw)
  if (normalized) return normalized

  if (docId != null && String(docId).trim()) {
    return sanitizeBlogSlug(`post-${docId}`)
  }

  throw new Error(
    `Blog post slug could not be derived (slug=${JSON.stringify(slug)}, title=${JSON.stringify(title)})`,
  )
}
