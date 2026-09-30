import type { Endpoint, PayloadRequest } from 'payload'

import { isCiServiceAuthorized } from '../access/ciServiceAuth'
import { blogPostDataFromFile, slugFromBlogFilename } from '../lib/blogContentFiles'
import { parseEndpointJsonBody } from '../lib/parseEndpointBody'

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function findTenantBySlug(req: PayloadRequest, slug: string) {
  const result = await req.payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  return result.docs[0] ?? null
}

function parsePosts(body: Record<string, unknown>): Array<{ filename: string; content: string }> {
  const raw = body.posts
  if (!Array.isArray(raw)) return []
  const out: Array<{ filename: string; content: string }> = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const filename = (row as { filename?: unknown }).filename
    const content = (row as { content?: unknown }).content
    if (typeof filename !== 'string' || typeof content !== 'string') continue
    if (!slugFromBlogFilename(filename)) continue
    out.push({ filename, content })
  }
  return out
}

/**
 * CI bulk import — repo markdown/MDX parsed on the runner, posted here.
 *
 *   POST /api/tenants/import-blog-content
 *
 * Auth: super-admin API key or `x-deploy-report-token` (= DEPLOY_REPORT_TOKEN).
 */
export const importBlogContentEndpoint: Endpoint = {
  path: '/import-blog-content',
  method: 'post',
  handler: async (req) => {
    if (!isCiServiceAuthorized(req)) {
      return json(
        {
          ok: false,
          message:
            'Unauthorized. Use a super-admin API key or x-deploy-report-token (DEPLOY_REPORT_TOKEN).',
        },
        401,
      )
    }

    const body = await parseEndpointJsonBody(req)
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    const onlyIfEmpty = body.onlyIfEmpty === true

    if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
      return json({ ok: false, message: 'Invalid or missing slug.' }, 400)
    }

    const posts = parsePosts(body)
    if (posts.length === 0) {
      return json({ ok: false, message: 'No valid posts (.md / .mdx) in body.' }, 400)
    }

    const tenant = await findTenantBySlug(req, slug)
    if (!tenant) return json({ ok: false, message: `Tenant not found: ${slug}` }, 404)

    const tenantId = tenant.id

    if (onlyIfEmpty) {
      const existing = await req.payload.count({
        collection: 'blog-posts',
        where: { tenant: { equals: tenantId } },
        overrideAccess: true,
      })
      if (existing.totalDocs > 0) {
        return json({
          ok: true,
          skipped: true,
          reason: `${existing.totalDocs} post(s) already in Payload`,
        })
      }
    }

    let created = 0
    let updated = 0
    const failures: string[] = []

    for (const { filename, content } of posts) {
      try {
        const postSlug = slugFromBlogFilename(filename)!
        const baseData = blogPostDataFromFile(content, postSlug, tenantId)

        const found = await req.payload.find({
          collection: 'blog-posts',
          where: {
            and: [{ tenant: { equals: tenantId } }, { slug: { equals: postSlug } }],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        const existing = found.docs[0]
        if (existing) {
          await req.payload.update({
            collection: 'blog-posts',
            id: existing.id,
            data: baseData as never,
            overrideAccess: true,
          })
          updated++
        } else {
          await req.payload.create({
            collection: 'blog-posts',
            data: baseData as never,
            overrideAccess: true,
          })
          created++
        }
      } catch (err) {
        failures.push(
          `${filename}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    if (created === 0 && updated === 0 && failures.length > 0) {
      return json(
        {
          ok: false,
          message: 'Import failed for all posts in batch.',
          failures,
        },
        500,
      )
    }

    if (created > 0 || updated > 0) {
      await req.payload.update({
        collection: 'tenants',
        id: tenantId,
        data: { blogImportedFromRepoAt: new Date().toISOString() } as never,
        overrideAccess: true,
      })
    }

    return json({
      ok: true,
      created,
      updated,
      fileCount: posts.length,
      ...(failures.length > 0 ? { failures } : {}),
    })
  },
}
