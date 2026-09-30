#!/usr/bin/env tsx
/**
 * Import blog markdown into Payload via REST API (for CI / no DATABASE_URI).
 *
 *   PAYLOAD_URL=... DEPLOY_REPORT_TOKEN=... pnpm import:blog-from-repo-api -- \
 *     --slug keukenfaqs --site /path/to/repo
 */
import { resolveSitePath } from '../src/lib/importBlogFromRepo'
import { importBlogFromRepoViaApi } from '../src/lib/importBlogFromRepoViaApi'

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
      'Usage: import-blog-from-repo-api --slug <slug> --site <repo-root> [--blog-path src/content/blog]',
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
  const url = process.env.PAYLOAD_URL?.replace(/\/+$/, '')
  const apiKey = process.env.PAYLOAD_API_KEY
  const deployReportToken = process.env.DEPLOY_REPORT_TOKEN
  if (!url || (!apiKey && !deployReportToken)) {
    console.error('[import-blog-api] PAYLOAD_URL and DEPLOY_REPORT_TOKEN (or super-admin PAYLOAD_API_KEY) required.')
    process.exit(1)
  }

  console.log(`[import-blog-api] slug=${args.slug} dir=${resolveSitePath(args.site)}`)

  const result = await importBlogFromRepoViaApi({
    url,
    apiKey,
    deployReportToken,
    tenantSlug: args.slug,
    siteRoot: args.site,
    blogPath: args.blogPath,
    limit: args.limit,
  })

  console.log(
    `[import-blog-api] done: ${result.created} created, ${result.updated} updated (${result.fileCount} files)`,
  )
}

void main()
