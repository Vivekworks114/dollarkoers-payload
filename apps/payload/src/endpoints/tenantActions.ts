import type { Endpoint, PayloadRequest } from 'payload'

import { canPublishTenantRequest } from '../access/canPublishTenant'
import { isSuperAdmin } from '../access/isSuperAdmin'
import { dispatchTenantDeploy } from '../lib/dispatchTenantDeploy'
import { dispatchCiJob } from '../lib/ci/dispatchCiJob'

/**
 *   POST /api/tenants/:id/scaffold  — super-admin, opens scaffold PR
 *   POST /api/tenants/:id/deploy    — super-admin, redeploy (code + content)
 *   POST /api/tenants/:id/publish   — editors + super-admin, push CMS → live site
 */

type JsonResponse = {
  ok: boolean
  message: string
  runsUrl?: string | null
  runUrl?: string | null
  ciProvider?: 'jenkins' | 'github_actions'
  deployMode?: 'monorepo' | 'external'
  deployTarget?: string
}

function json(body: JsonResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function loadTenant(req: PayloadRequest, id: string) {
  return req.payload.findByID({ collection: 'tenants', id }) as Promise<{
    id: string | number
    slug?: string
    name?: string
    domain?: string
    githubWorkflow?: string
    githubRepo?: string | null
    githubBranch?: string | null
    blogContentPath?: string | null
    enabledModules?: string[] | null
  } | null>
}

function extractId(req: PayloadRequest): string | null {
  const params = (req as unknown as { routeParams?: Record<string, unknown> }).routeParams
  const id = params?.id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

async function markScaffoldDispatched(
  req: PayloadRequest,
  tenantId: string | number,
  runUrl: string | null | undefined,
): Promise<void> {
  await req.payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      lastScaffoldStatus: 'dispatched',
      lastScaffoldRunUrl: runUrl ?? undefined,
      lastScaffoldError: null,
    } as never,
    overrideAccess: true,
  })
}

export const publishEndpoint: Endpoint = {
  path: '/:id/publish',
  method: 'post',
  handler: async (req) => {
    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)
    if (!req.user) return json({ ok: false, message: 'You must be logged in to publish.' }, 401)
    if (!canPublishTenantRequest(req, id)) {
      return json({ ok: false, message: 'You do not have permission to publish this site.' }, 403)
    }

    const tenant = await loadTenant(req, id)
    if (!tenant) return json({ ok: false, message: 'Tenant not found.' }, 404)

    const result = await dispatchTenantDeploy(req, tenant, 'publish content from admin')
    return json(
      {
        ok: result.ok,
        message: result.message,
        runsUrl: result.runsUrl,
        runUrl: result.runUrl,
        ciProvider: result.ciProvider,
        deployMode: result.deployMode,
        deployTarget: result.deployTarget,
      },
      result.status,
    )
  },
}

export const scaffoldEndpoint: Endpoint = {
  path: '/:id/scaffold',
  method: 'post',
  handler: async (req) => {
    if (!isSuperAdmin(req.user)) {
      return json({ ok: false, message: 'Only super-admins can scaffold tenants.' }, 403)
    }
    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)

    const tenant = await loadTenant(req, id)
    if (!tenant) return json({ ok: false, message: 'Tenant not found.' }, 404)
    if (!tenant.slug || !tenant.domain || !tenant.name) {
      return json(
        { ok: false, message: 'Tenant is missing slug, domain, or name. Save the tenant first.' },
        400,
      )
    }

    const result = await dispatchCiJob(
      {
        job: 'tenant-scaffold',
        parameters: {
          tenant_slug: tenant.slug,
          tenant_domain: tenant.domain,
          tenant_name: tenant.name,
        },
      },
      req.payload,
    )
    const runsUrl = result.runsUrl ?? result.runUrl
    if (!result.ok) {
      return json(
        {
          ok: false,
          message: result.error ?? 'CI dispatch failed.',
          runsUrl,
          runUrl: result.runUrl,
          ciProvider: result.ciProvider,
        },
        result.status,
      )
    }

    await markScaffoldDispatched(req, tenant.id, result.runUrl)

    return json({
      ok: true,
      message: `Scaffold dispatched for "${tenant.slug}". A pull request will appear on GitHub within ~30 seconds. Merge it to bring the new tenant online.`,
      runsUrl,
      runUrl: result.runUrl,
      ciProvider: result.ciProvider,
    })
  },
}

export const deployEndpoint: Endpoint = {
  path: '/:id/deploy',
  method: 'post',
  handler: async (req) => {
    if (!isSuperAdmin(req.user)) {
      return json({ ok: false, message: 'Only super-admins can run a full redeploy.' }, 403)
    }
    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)

    const tenant = await loadTenant(req, id)
    if (!tenant) return json({ ok: false, message: 'Tenant not found.' }, 404)

    const result = await dispatchTenantDeploy(req, tenant, 'manual redeploy from admin')
    return json(
      {
        ok: result.ok,
        message: result.ok
          ? `Redeploy dispatched for "${tenant.slug}". Status updates when CI finishes (~2 minutes).`
          : result.message,
        runsUrl: result.runsUrl,
        runUrl: result.runUrl,
        ciProvider: result.ciProvider,
      },
      result.status,
    )
  },
}
