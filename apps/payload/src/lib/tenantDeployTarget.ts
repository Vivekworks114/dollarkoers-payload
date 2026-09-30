import { parseGithubRepo, resolveDeployMode } from './parseGithubRepo'

export type DeployMode = 'monorepo' | 'external'

export interface TenantDeployTargetInfo {
  mode: DeployMode
  label: string
  shortLabel: string
  githubRepo: string | null
  githubBranch: string
  blogContentPath: string
}

export function getTenantDeployTargetInfo(tenant: {
  slug?: string
  githubRepo?: string | null
  githubBranch?: string | null
  blogContentPath?: string | null
}): TenantDeployTargetInfo | null {
  if (!tenant.slug) return null

  const mode = resolveDeployMode(tenant)
  const parsed = tenant.githubRepo ? parseGithubRepo(tenant.githubRepo) : null
  const branch = tenant.githubBranch?.trim() || 'main'
  const blogContentPath = tenant.blogContentPath?.trim() || 'src/content/blog'

  if (mode === 'external' && parsed) {
    return {
      mode: 'external',
      label: `${parsed.full} @ ${branch} → ${blogContentPath}`,
      shortLabel: parsed.full,
      githubRepo: parsed.full,
      githubBranch: branch,
      blogContentPath,
    }
  }

  return {
    mode: 'monorepo',
    label: `apps/sites/${tenant.slug}`,
    shortLabel: tenant.slug,
    githubRepo: null,
    githubBranch: branch,
    blogContentPath,
  }
}
