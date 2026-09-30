import type { Endpoint, PayloadRequest } from 'payload'

import { isCiServiceAuthorized } from '../access/ciServiceAuth'
import { parseEndpointJsonBody } from '../lib/parseEndpointBody'
import {
  DEPLOY_STATUSES,
  SCAFFOLD_STATUSES,
  type DeployStatus,
  type ReportDeployBody,
  type ReportScaffoldBody,
  type ScaffoldStatus,
  workersDevUrlFromParts,
} from '../lib/tenantDeployStatus'
import { GITHUB_SETUP_STATUSES, type GithubSetupStatus } from '../lib/tenantModules'

/**
 * CI callbacks — update deploy/scaffold status on a tenant by slug.
 *
 *   POST /api/tenants/report-deploy
 *   POST /api/tenants/report-scaffold
 *   POST /api/tenants/report-github-setup
 *
 * Auth: super-admin API key (`Authorization: users API-Key …`) or
 * `x-deploy-report-token` matching DEPLOY_REPORT_TOKEN (optional shared secret).
 */

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const isAuthorized = isCiServiceAuthorized

async function findTenantBySlug(req: PayloadRequest, slug: string) {
  const result = await req.payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  return result.docs[0] ?? null
}

function isDeployStatus(v: unknown): v is DeployStatus {
  return typeof v === 'string' && (DEPLOY_STATUSES as readonly string[]).includes(v)
}

function isScaffoldStatus(v: unknown): v is ScaffoldStatus {
  return typeof v === 'string' && (SCAFFOLD_STATUSES as readonly string[]).includes(v)
}

function isGithubSetupStatus(v: unknown): v is GithubSetupStatus {
  return typeof v === 'string' && (GITHUB_SETUP_STATUSES as readonly string[]).includes(v)
}

async function parseJsonBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  return parseEndpointJsonBody(req)
}

export const reportDeployEndpoint: Endpoint = {
  path: '/report-deploy',
  method: 'post',
  handler: async (req) => {
    if (!isAuthorized(req)) {
      return json({ ok: false, message: 'Unauthorized.' }, 401)
    }

    const body = await parseJsonBody(req)
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    const status = body.status

    if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
      return json({ ok: false, message: 'Invalid or missing slug.' }, 400)
    }
    if (!isDeployStatus(status)) {
      return json({ ok: false, message: `Invalid status. Expected one of: ${DEPLOY_STATUSES.join(', ')}` }, 400)
    }

    const tenant = await findTenantBySlug(req, slug)
    if (!tenant) return json({ ok: false, message: `Tenant not found: ${slug}` }, 404)

    const report = body as unknown as ReportDeployBody
    let workersDevUrl =
      typeof report.workersDevUrl === 'string' ? report.workersDevUrl.trim() : undefined
    if (!workersDevUrl && status === 'success') {
      workersDevUrl =
        workersDevUrlFromParts(slug, process.env.CLOUDFLARE_WORKERS_DEV_SUBDOMAIN) ?? undefined
    }

    const previewUrl =
      typeof report.previewUrl === 'string'
        ? report.previewUrl.trim()
        : workersDevUrl && status === 'success'
          ? workersDevUrl
          : undefined

    const patch: Record<string, unknown> = {
      lastDeployStatus: status,
    }
    if (status === 'in_progress' || status === 'dispatched' || status === 'success' || status === 'failure') {
      if (status === 'success' || status === 'failure') {
        patch.lastDeployAt = new Date().toISOString()
      }
    }
    if (typeof report.runUrl === 'string' && report.runUrl) patch.lastDeployRunUrl = report.runUrl
    if (workersDevUrl) patch.workersDevUrl = workersDevUrl
    if (previewUrl) patch.previewUrl = previewUrl
    if (status === 'failure' && typeof report.error === 'string') {
      patch.lastDeployError = report.error.slice(0, 2000)
    } else if (status === 'success') {
      patch.lastDeployError = null
    }

    await req.payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: patch,
      overrideAccess: true,
    })

    return json({
      ok: true,
      message: `Deploy status for "${slug}" set to ${status}.`,
      workersDevUrl: workersDevUrl ?? null,
      previewUrl: previewUrl ?? null,
    })
  },
}

export const reportScaffoldEndpoint: Endpoint = {
  path: '/report-scaffold',
  method: 'post',
  handler: async (req) => {
    if (!isAuthorized(req)) {
      return json({ ok: false, message: 'Unauthorized.' }, 401)
    }

    const body = await parseJsonBody(req)
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    const status = body.status

    if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
      return json({ ok: false, message: 'Invalid or missing slug.' }, 400)
    }
    if (!isScaffoldStatus(status)) {
      return json(
        { ok: false, message: `Invalid status. Expected one of: ${SCAFFOLD_STATUSES.join(', ')}` },
        400,
      )
    }

    const tenant = await findTenantBySlug(req, slug)
    if (!tenant) return json({ ok: false, message: `Tenant not found: ${slug}` }, 404)

    const report = body as unknown as ReportScaffoldBody
    const patch: Record<string, unknown> = {
      lastScaffoldStatus: status,
    }
    if (status === 'success' || status === 'failure') {
      patch.lastScaffoldAt = new Date().toISOString()
    }
    if (typeof report.runUrl === 'string' && report.runUrl) patch.lastScaffoldRunUrl = report.runUrl
    if (typeof report.prUrl === 'string' && report.prUrl) patch.lastScaffoldPrUrl = report.prUrl
    if (status === 'failure' && typeof report.error === 'string') {
      patch.lastScaffoldError = report.error.slice(0, 2000)
    } else if (status === 'success') {
      patch.lastScaffoldError = null
    }

    await req.payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: patch,
      overrideAccess: true,
    })

    return json({ ok: true, message: `Scaffold status for "${slug}" set to ${status}.` })
  },
}

export const reportGithubSetupEndpoint: Endpoint = {
  path: '/report-github-setup',
  method: 'post',
  handler: async (req) => {
    if (!isAuthorized(req)) {
      return json({ ok: false, message: 'Unauthorized.' }, 401)
    }

    const body = await parseJsonBody(req)
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    const status = body.status

    if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
      return json({ ok: false, message: 'Invalid or missing slug.' }, 400)
    }
    if (!isGithubSetupStatus(status)) {
      return json(
        {
          ok: false,
          message: `Invalid status. Expected one of: ${GITHUB_SETUP_STATUSES.join(', ')}`,
        },
        400,
      )
    }

    const tenant = await findTenantBySlug(req, slug)
    if (!tenant) return json({ ok: false, message: `Tenant not found: ${slug}` }, 404)

    const patch: Record<string, unknown> = {
      githubSetupStatus: status,
    }
    if (typeof body.prUrl === 'string' && body.prUrl) {
      patch.lastScaffoldPrUrl = body.prUrl
    }
    if (typeof body.notes === 'string' && body.notes) {
      patch.githubValidationNotes = body.notes.slice(0, 4000)
    }
    if (status === 'ready') {
      patch.lastScaffoldStatus = 'success'
      patch.lastScaffoldAt = new Date().toISOString()
      patch.lastScaffoldError = null
    } else if (status === 'failed' && typeof body.error === 'string') {
      patch.lastScaffoldError = body.error.slice(0, 2000)
    }

    await req.payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: patch as never,
      overrideAccess: true,
    })

    return json({ ok: true, message: `GitHub setup for "${slug}" set to ${status}.` })
  },
}
