/**
 * Rules for when a blog post is included in site sync / live deploy.
 *
 * - draft: never on live site
 * - scheduled: CMS only until cron promotes to published (then deploy runs)
 * - published: live when pubDate <= now
 */

export type BlogPublishStatus = 'draft' | 'scheduled' | 'published'

/** Payload `where` clause: posts that should appear on the live site. */
export function liveBlogPostsWhere(asOf: Date = new Date()): Record<string, unknown> {
  return {
    publishStatus: { equals: 'published' },
    pubDate: { less_than_equal: asOf.toISOString() },
  }
}

/** Scheduled posts whose go-live time has passed (for auto-promote + deploy). */
export function dueScheduledPostsWhere(asOf: Date = new Date()): Record<string, unknown> {
  return {
    publishStatus: { equals: 'scheduled' },
    pubDate: { less_than_equal: asOf.toISOString() },
  }
}

export function isFuturePubDate(pubDate: string | Date | null | undefined, asOf = new Date()): boolean {
  if (!pubDate) return false
  const d = pubDate instanceof Date ? pubDate : new Date(String(pubDate))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > asOf.getTime()
}
