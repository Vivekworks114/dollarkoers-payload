import path from 'node:path'

import { PayloadClient } from '@dollarkoers/payload-sdk'

import {
  blogPostDataFromFile,
  countBlogContentFilenames,
  slugFromBlogFilename,
} from './blogContentFiles'
import {
  type ImportBlogFromRepoOptions,
  type ImportBlogFromRepoResult,
  readBlogPostsFromSite,
  resolveSitePath,
} from './importBlogFromRepo'

export interface ImportBlogViaApiOptions extends ImportBlogFromRepoOptions {
  url: string
  apiKey?: string
  deployReportToken?: string
}

interface CiImportResponse {
  ok?: boolean
  skipped?: boolean
  reason?: string
  created?: number
  updated?: number
  fileCount?: number
  message?: string
}

function authHeaders(options: ImportBlogViaApiOptions): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.deployReportToken) {
    headers['x-deploy-report-token'] = options.deployReportToken
  }
  if (options.apiKey) {
    headers.Authorization = `users API-Key ${options.apiKey}`
  }
  return headers
}

/** Stay under Next.js / reverse-proxy body limits (~1–10MB default). */
const CI_IMPORT_BATCH_MAX_BYTES = 3 * 1024 * 1024
const CI_IMPORT_BATCH_MAX_POSTS = 15

function estimatePostBytes(post: { filename: string; content: string }): number {
  return Buffer.byteLength(post.filename, 'utf8') + Buffer.byteLength(post.content, 'utf8') + 64
}

function chunkPostsForCiImport(
  posts: Array<{ filename: string; content: string }>,
): Array<Array<{ filename: string; content: string }>> {
  const batches: Array<Array<{ filename: string; content: string }>> = []
  let current: Array<{ filename: string; content: string }> = []
  let currentBytes = 256 // JSON wrapper overhead

  for (const post of posts) {
    const postBytes = estimatePostBytes(post)
    const wouldExceedBytes = current.length > 0 && currentBytes + postBytes > CI_IMPORT_BATCH_MAX_BYTES
    const wouldExceedCount = current.length >= CI_IMPORT_BATCH_MAX_POSTS

    if (wouldExceedBytes || wouldExceedCount) {
      batches.push(current)
      current = []
      currentBytes = 256
    }

    current.push(post)
    currentBytes += postBytes
  }

  if (current.length > 0) batches.push(current)
  return batches
}

/**
 * Import via CMS endpoint (overrideAccess) — works with DEPLOY_REPORT_TOKEN only.
 */
async function importBlogViaCiEndpoint(
  options: ImportBlogViaApiOptions,
  posts: Array<{ filename: string; content: string }>,
  onlyIfEmpty: boolean,
): Promise<ImportBlogFromRepoResult & { skipped?: boolean; reason?: string }> {
  const base = options.url.replace(/\/+$/, '')
  const res = await fetch(`${base}/api/tenants/import-blog-content`, {
    method: 'POST',
    headers: authHeaders(options),
    body: JSON.stringify({
      slug: options.tenantSlug,
      onlyIfEmpty,
      posts,
    }),
  })

  const text = await res.text().catch(() => '')
  let body: CiImportResponse = {}
  try {
    body = JSON.parse(text) as CiImportResponse
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const hint =
      res.status === 403
        ? ' CI needs DEPLOY_REPORT_TOKEN (recommended) or a super-admin PAYLOAD_API_KEY.'
        : ''
    throw new Error(
      `[import-blog-ci] POST /api/tenants/import-blog-content -> ${res.status}: ${text.slice(0, 500)}${hint}`,
    )
  }

  if (body.skipped) {
    return {
      skipped: true,
      reason: body.reason,
      created: 0,
      updated: 0,
      fileCount: 0,
      blogDir: '',
    }
  }

  return {
    created: body.created ?? 0,
    updated: body.updated ?? 0,
    fileCount: body.fileCount ?? posts.length,
    blogDir: '',
  }
}

/** POST markdown in batches so large repos stay under request body limits. */
async function importBlogViaCiEndpointBatched(
  options: ImportBlogViaApiOptions,
  posts: Array<{ filename: string; content: string }>,
  onlyIfEmpty: boolean,
): Promise<ImportBlogFromRepoResult & { skipped?: boolean; reason?: string }> {
  const batches = chunkPostsForCiImport(posts)
  let created = 0
  let updated = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!
    const batchOnlyIfEmpty = onlyIfEmpty && i === 0
    console.log(
      `[import-blog-ci] batch ${i + 1}/${batches.length}: ${batch.length} file(s), ~${Math.round(
        batch.reduce((sum, p) => sum + estimatePostBytes(p), 0) / 1024,
      )}KB`,
    )

    const result = await importBlogViaCiEndpoint(options, batch, batchOnlyIfEmpty)
    if (result.skipped) return result

    created += result.created
    updated += result.updated
  }

  return { created, updated, fileCount: posts.length, blogDir: '' }
}

/**
 * Import repo markdown/MDX into Payload over HTTPS (no direct Postgres).
 */
export async function importBlogFromRepoViaApi(
  options: ImportBlogViaApiOptions,
): Promise<ImportBlogFromRepoResult> {
  const { blogDir, posts } = await readBlogPostsFromSite(options)

  if (options.deployReportToken) {
    const result = await importBlogViaCiEndpointBatched(options, posts, false)
    if (result.skipped) {
      throw new Error(result.reason ?? 'Import skipped')
    }
    return { ...result, blogDir }
  }

  if (!options.apiKey) {
    throw new Error(
      '[import-blog] PAYLOAD_API_KEY or DEPLOY_REPORT_TOKEN is required for REST import.',
    )
  }

  const client = new PayloadClient({
    url: options.url,
    apiKey: options.apiKey,
    tenantSlug: options.tenantSlug,
  })

  const tenantId = await client.resolveTenantId()
  let created = 0
  let updated = 0

  for (const { filename, content } of posts) {
    const slug = slugFromBlogFilename(filename)!
    const baseData = blogPostDataFromFile(content, slug, tenantId)

    const existing = await client.findOne<{ id: string }>('blog-posts', {
      slug: { equals: slug },
    })

    try {
      if (existing?.id) {
        await client.update('blog-posts', existing.id, baseData)
        updated++
      } else {
        await client.create('blog-posts', baseData)
        created++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('403')) {
        throw new Error(
          `${msg}\n` +
            'Fix: set GitHub secret DEPLOY_REPORT_TOKEN to match Payload .env (recommended), ' +
            'or use a super-admin user API key for PAYLOAD_API_KEY.',
        )
      }
      throw err
    }
  }

  if (created > 0 || updated > 0) {
    try {
      await client.update('tenants', tenantId, {
        blogImportedFromRepoAt: new Date().toISOString(),
      })
    } catch {
      // Non-fatal — tenant update requires super-admin; CI endpoint sets this when using token.
    }
  }

  return { created, updated, fileCount: posts.length, blogDir }
}

export async function autoImportBlogIfEmptyViaApi(
  options: ImportBlogViaApiOptions,
): Promise<{ skipped: boolean; reason?: string; result?: ImportBlogFromRepoResult }> {
  const blogPath = options.blogPath?.replace(/^\/+/, '') || 'src/content/blog'
  const blogDir = path.join(resolveSitePath(options.siteRoot), blogPath)

  if (options.deployReportToken) {
    let posts: Array<{ filename: string; content: string }>
    try {
      ;({ posts } = await readBlogPostsFromSite(options))
    } catch {
      return { skipped: true, reason: `no blog folder at ${blogDir}` }
    }
    if (posts.length === 0) {
      return { skipped: true, reason: `no .md or .mdx files in ${blogDir}` }
    }

    const result = await importBlogViaCiEndpointBatched(options, posts, true)
    if (result.skipped) {
      return { skipped: true, reason: result.reason }
    }
    return {
      skipped: false,
      result: {
        created: result.created,
        updated: result.updated,
        fileCount: result.fileCount,
        blogDir,
      },
    }
  }

  if (!options.apiKey) {
    throw new Error(
      '[auto-import-blog] PAYLOAD_API_KEY or DEPLOY_REPORT_TOKEN is required (no database access from CI).',
    )
  }

  const client = new PayloadClient({
    url: options.url,
    apiKey: options.apiKey,
    tenantSlug: options.tenantSlug,
  })

  const existing = await client.count('blog-posts')
  if (existing > 0) {
    return { skipped: true, reason: `${existing} post(s) already in Payload` }
  }

  let entries: string[]
  try {
    const fs = await import('node:fs/promises')
    entries = await fs.readdir(blogDir)
  } catch {
    return { skipped: true, reason: `no blog folder at ${blogDir}` }
  }

  const fileCount = countBlogContentFilenames(entries)
  if (fileCount === 0) {
    return { skipped: true, reason: `no .md or .mdx files in ${blogDir}` }
  }

  const result = await importBlogFromRepoViaApi(options)
  return { skipped: false, result }
}
