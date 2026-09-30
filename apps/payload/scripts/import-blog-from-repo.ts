#!/usr/bin/env tsx
/**
 * One-time import: markdown blog posts from a connected Astro repo → Payload.
 *
 *   pnpm import:blog-from-repo -- --slug keukenfaqs --site ../client-repo --blog-path src/content/blog
 */
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { importBlogFromRepo, resolveSitePath } from '../src/lib/importBlogFromRepo'

function parseArgs() {
  const argv = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a?.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    }
  }
  const slug = out.slug
  const site = out.site
  if (!slug || !site) {
    console.error(
      'Usage: import-blog-from-repo --slug <slug> --site <repo-root> [--blog-path src/content/blog] [--limit N]',
    )
    process.exit(1)
  }
  return {
    slug,
    site,
    blogPath: out['blog-path'] || 'src/content/blog',
    limit: out.limit ? Number(out.limit) : undefined,
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const blogDir = `${resolveSitePath(args.site)}/${args.blogPath.replace(/^\/+/, '')}`
  console.log(`[import-blog] slug=${args.slug} dir=${blogDir}`)

  const payload = await getPayload({ config })
  const result = await importBlogFromRepo(payload, {
    tenantSlug: args.slug,
    siteRoot: args.site,
    blogPath: args.blogPath,
    limit: args.limit,
  })

  console.log(
    `[import-blog] done: ${result.created} created, ${result.updated} updated (${result.fileCount} files)`,
  )
}

void main()
