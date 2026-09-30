import type { Endpoint, PayloadRequest } from 'payload'

import { isSuperAdmin } from '../access/isSuperAdmin'
import { dispatchCiJob } from '../lib/ci/dispatchCiJob'
import { parseGithubRepo } from '../lib/parseGithubRepo'
import { validateGithubRepository } from '../lib/githubRepoApi'
import {
  resolveGithubTokenForTenant,
  type TenantGithubAuth,
} from '../lib/resolveGithubToken'
import { tenantHasModule } from '../lib/tenantModules'

type JsonBody = {
  ok: boolean
  message: string
  notes?: string[]
  runsUrl?: string | null
  runUrl?: string | null
  ciProvider?: 'jenkins' | 'github_actions'
}

function json(body: JsonBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function extractId(req: PayloadRequest): string | null {
  const params = (req as unknown as { routeParams?: Record<string, unknown> }).routeParams
  const id = params?.id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

async function loadTenant(req: PayloadRequest, id: string, depth = 0) {
  return req.payload.findByID({ collection: 'tenants', id, depth }) as Promise<{
    id: string | number
    slug?: string
    githubRepo?: string | null
    githubBranch?: string | null
    blogContentPath?: string | null
    enabledModules?: string[] | null
    githubCredential?: unknown
  } | null>
}

function requireSuperAdmin(req: PayloadRequest): Response | null {
  if (!req.user) return json({ ok: false, message: 'You must be logged in.' }, 401)
  if (!isSuperAdmin(req.user)) {
    return json({ ok: false, message: 'Only super-admins can manage GitHub integration.' }, 403)
  }
  return null
}

export const validateGithubEndpoint: Endpoint = {
  path: '/:id/validate-github',
  method: 'post',
  handler: async (req) => {
    const denied = requireSuperAdmin(req)
    if (denied) return denied

    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)

    const tenant = await loadTenant(req, id, 1)
    if (!tenant) return json({ ok: false, message: 'Tenant not found.' }, 404)

    const parsed = tenant.githubRepo ? parseGithubRepo(tenant.githubRepo) : null
    if (!parsed) {
      return json({ ok: false, message: 'Set a valid GitHub repository (owner/repo) first.' }, 400)
    }

    const auth = await resolveGithubTokenForTenant(req.payload, tenant as TenantGithubAuth)
    const result = await validateGithubRepository({
      repoFull: parsed.full,
      branch: tenant.githubBranch?.trim() || 'main',
      blogContentPath: tenant.blogContentPath?.trim() || 'src/content/blog',
      token: auth?.token,
    })

    if (tenant.githubCredential && typeof tenant.githubCredential === 'object') {
      const credId = (tenant.githubCredential as { id?: string | number }).id
      if (credId != null) {
        await req.payload.update({
          collection: 'github-credentials',
          id: credId,
          data: {
            lastValidatedAt: new Date().toISOString(),
            lastValidationError: result.ok ? null : result.message,
          } as never,
          overrideAccess: true,
        })
      }
    }

    await req.payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        githubSetupStatus: result.ok ? 'validated' : 'failed',
        githubValidationNotes: [
          auth ? `Token source: ${auth.source}.` : 'Token source: platform env.',
          ...result.notes,
        ].join('\n'),
      } as never,
      overrideAccess: true,
    })

    return json({
      ok: result.ok,
      message: result.message,
      notes: result.notes,
    })
  },
}

export const setupGithubRepoEndpoint: Endpoint = {
  path: '/:id/setup-github-repo',
  method: 'post',
  handler: async (req) => {
    const denied = requireSuperAdmin(req)
    if (denied) return denied

    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)

    const tenant = await loadTenant(req, id)
    if (!tenant?.slug) return json({ ok: false, message: 'Tenant not found.' }, 404)

    const parsed = tenant.githubRepo ? parseGithubRepo(tenant.githubRepo) : null
    if (!parsed) {
      return json({ ok: false, message: 'Set a valid GitHub repository first.' }, 400)
    }

    const result = await dispatchCiJob(
      {
        job: 'tenant-repo-setup',
        parameters: {
          tenant_slug: tenant.slug,
          github_repo: parsed.full,
          github_branch: tenant.githubBranch?.trim() || 'main',
          blog_content_path: tenant.blogContentPath?.trim() || 'src/content/blog',
        },
      },
      req.payload,
    )

    if (!result.ok) {
      return json(
        {
          ok: false,
          message: result.error ?? 'Failed to start setup pipeline.',
          runsUrl: result.runsUrl,
        },
        result.status,
      )
    }

    await req.payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        githubSetupStatus: 'setup_dispatched',
        lastScaffoldRunUrl: result.runUrl ?? undefined,
      } as never,
      overrideAccess: true,
    })

    return json({
      ok: true,
      message: `Setup workflow started. A pull request will be opened on ${parsed.full}.`,
      runUrl: result.runUrl,
      runsUrl: result.runUrl ?? result.runsUrl,
      ciProvider: result.ciProvider,
    })
  },
}

export const importBlogFromRepoEndpoint: Endpoint = {
  path: '/:id/import-blog-from-repo',
  method: 'post',
  handler: async (req) => {
    const denied = requireSuperAdmin(req)
    if (denied) return denied

    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)

    const tenant = await loadTenant(req, id)
    if (!tenant?.slug) return json({ ok: false, message: 'Tenant not found.' }, 404)

    if (!tenantHasModule(tenant.enabledModules, 'blog')) {
      return json({ ok: false, message: 'Enable the blog module first.' }, 400)
    }

    const parsed = tenant.githubRepo ? parseGithubRepo(tenant.githubRepo) : null
    if (!parsed) {
      return json(
        {
          ok: false,
          message: 'Connect a GitHub repository first, or run import locally with tenant-cli import-blog.',
        },
        400,
      )
    }

    const result = await dispatchCiJob(
      {
        job: 'tenant-import-blog',
        parameters: {
          tenant_slug: tenant.slug,
          github_repo: parsed.full,
          github_branch: tenant.githubBranch?.trim() || 'main',
          blog_content_path: tenant.blogContentPath?.trim() || 'src/content/blog',
        },
      },
      req.payload,
    )

    if (!result.ok) {
      return json(
        {
          ok: false,
          message: result.error ?? 'Failed to start import pipeline.',
          runsUrl: result.runsUrl,
        },
        result.status,
      )
    }

    return json({
      ok: true,
      message: `One-time import started from ${parsed.full}. Existing Payload posts with the same slug are updated.`,
      runUrl: result.runUrl,
      runsUrl: result.runUrl ?? result.runsUrl,
      ciProvider: result.ciProvider,
    })
  },
}
