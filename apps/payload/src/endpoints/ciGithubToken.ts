import type { Endpoint, PayloadRequest } from 'payload'

import { isCiServiceAuthorized } from '../access/ciServiceAuth'
import {
  resolveGithubTokenForTenant,
  type TenantGithubAuth,
} from '../lib/resolveGithubToken'

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function tenantSlugFromRequest(req: PayloadRequest): string | null {
  const url = new URL(req.url ?? 'http://localhost', 'http://localhost')
  const slug = url.searchParams.get('tenant')?.trim()
  if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) return null
  return slug
}

/**
 * CI-only: resolve GitHub PAT for checking out a tenant's external repo.
 *
 *   GET /api/ci/github-token?tenant=<slug>
 *
 * Auth (required): header `x-deploy-report-token` matching DEPLOY_REPORT_TOKEN
 * on the Payload server (same value as GitHub repo secret DEPLOY_REPORT_TOKEN).
 */
export const ciGithubTokenEndpoint: Endpoint = {
  path: '/ci/github-token',
  method: 'get',
  handler: async (req) => {
    if (!isCiServiceAuthorized(req)) {
      return json(
        {
          ok: false,
          message:
            'Unauthorized. Send header x-deploy-report-token matching DEPLOY_REPORT_TOKEN.',
        },
        401,
      )
    }

    const slug = tenantSlugFromRequest(req)
    if (!slug) {
      return json({ ok: false, message: 'Missing or invalid ?tenant= slug query parameter.' }, 400)
    }

    const result = await req.payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })

    const tenant = result.docs[0] as TenantGithubAuth | null

    if (!tenant) {
      return json({ ok: false, message: `Tenant "${slug}" not found.` }, 404)
    }

    const resolved = await resolveGithubTokenForTenant(req.payload, tenant)
    if (!resolved) {
      return json(
        {
          ok: false,
          message:
            'No GitHub token available. Link a GitHub credential on the tenant, or set EXTERNAL_REPO_GITHUB_TOKEN / GITHUB_TOKEN on Payload.',
        },
        404,
      )
    }

    return json({
      ok: true,
      token: resolved.token,
      source: resolved.source,
      tenant: slug,
    })
  },
}
