import type { PayloadRequest } from 'payload'

import {
  dispatchCiJob,
  isWorkflowUnexpectedInputsError,
  type CiDispatchResult,
} from './ci/dispatchCiJob'
import { parseGithubRepo, resolveDeployMode } from './parseGithubRepo'
import { getTenantDeployTargetInfo, type DeployMode } from './tenantDeployTarget'
import { tenantHasModule } from './tenantModules'

export interface DispatchTenantDeployResult {
  ok: boolean
  status: number
  message: string
  runsUrl?: string | null
  runUrl?: string | null
  ciProvider?: CiDispatchResult['ciProvider']
  error?: string
  deployMode?: DeployMode
  deployTarget?: string
}

export interface TenantDeployTarget {
  id: string | number
  slug?: string
  githubWorkflow?: string | null
  githubRepo?: string | null
  githubBranch?: string | null
  blogContentPath?: string | null
  enabledModules?: string[] | null
}

export async function dispatchTenantDeploy(
  req: PayloadRequest,
  tenant: TenantDeployTarget,
  reason: string,
): Promise<DispatchTenantDeployResult> {
  return dispatchTenantDeployWithPayload(req.payload, tenant, reason)
}

export async function dispatchTenantDeployWithPayload(
  payload: PayloadRequest['payload'],
  tenant: TenantDeployTarget,
  reason: string,
): Promise<DispatchTenantDeployResult> {
  if (!tenant.slug) {
    return { ok: false, status: 400, message: 'Tenant has no slug.', error: 'missing slug' }
  }

  if (!tenantHasModule(tenant.enabledModules, 'blog')) {
    return {
      ok: false,
      status: 400,
      message: 'Blog module is not enabled for this tenant. Enable it under the GitHub tab.',
    }
  }

  const deployMode = resolveDeployMode(tenant)
  const parsed = tenant.githubRepo ? parseGithubRepo(tenant.githubRepo) : null

  if (deployMode === 'external' && !parsed) {
    return {
      ok: false,
      status: 400,
      message: 'Invalid GitHub repository. Use owner/repo or a github.com URL.',
    }
  }

  if (deployMode === 'monorepo') {
    const path = await import('node:path')
    const fs = await import('node:fs/promises')
    const monorepoPath = path.resolve(process.cwd(), '..', 'sites', tenant.slug)
    try {
      await fs.access(monorepoPath)
    } catch {
      return {
        ok: false,
        status: 400,
        message: `No monorepo site at ${monorepoPath}. Connect a GitHub repository or run Scaffold tenant code.`,
      }
    }
  }

  const fullInputs = {
    tenant_slug: tenant.slug,
    reason,
    deploy_mode: deployMode,
    github_repo: parsed?.full ?? '',
    github_branch: tenant.githubBranch?.trim() || 'main',
    blog_content_path: tenant.blogContentPath?.trim() || 'src/content/blog',
  }

  const result: CiDispatchResult = await dispatchCiJob(
    {
      job: 'tenant-deploy',
      parameters: fullInputs,
      legacyParameterKeys: ['tenant_slug', 'reason'],
    },
    payload,
  )

  const runsUrl = result.runsUrl ?? result.runUrl

  if (!result.ok) {
    const ghBranch = process.env.GITHUB_BRANCH ?? 'main'
    if (isWorkflowUnexpectedInputsError(result.status, result.error) && deployMode === 'external') {
      return {
        ok: false,
        status: 422,
        message:
          `Deploy pipeline is outdated and does not accept external-repo inputs. ` +
          `Update tenant-deploy on branch "${ghBranch}", then try again.`,
        runsUrl,
        runUrl: result.runUrl,
        ciProvider: result.ciProvider,
        error: result.error,
        deployMode,
      }
    }

    return {
      ok: false,
      status: result.status,
      message: result.error ?? 'CI dispatch failed.',
      runsUrl,
      runUrl: result.runUrl,
      ciProvider: result.ciProvider,
      error: result.error,
    }
  }

  await payload.update({
    collection: 'tenants',
    id: tenant.id,
    data: {
      lastDeployStatus: 'dispatched',
      lastDeployRunUrl: result.runUrl ?? undefined,
      lastDeployError: null,
      lastPublishedAt: new Date().toISOString(),
    } as never,
    overrideAccess: true,
  })

  const targetInfo = getTenantDeployTargetInfo(tenant)
  const targetLabel = targetInfo?.label ?? tenant.slug

  let message = `The live site updates when CI finishes (~2 minutes).`
  if (result.usedLegacyWorkflowInputs) {
    message +=
      ' Note: GitHub is running an older tenant-deploy.yml (monorepo only). Push the latest workflow file to main for external-repo deploys.'
  }

  return {
    ok: true,
    status: 200,
    message,
    runsUrl,
    runUrl: result.runUrl,
    ciProvider: result.ciProvider,
    deployMode,
    deployTarget: targetLabel,
  }
}
