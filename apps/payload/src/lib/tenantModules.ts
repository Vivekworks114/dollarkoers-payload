/** CMS modules a tenant can enable. Sync and publish only run for enabled modules. */
export const TENANT_MODULES = ['blog'] as const

export const GITHUB_SETUP_STATUSES = [
  'not_connected',
  'validated',
  'setup_dispatched',
  'ready',
  'failed',
] as const

export type GithubSetupStatus = (typeof GITHUB_SETUP_STATUSES)[number]

export type TenantModule = (typeof TENANT_MODULES)[number]

export function tenantHasModule(
  enabled: string[] | null | undefined,
  module: TenantModule,
): boolean {
  if (!enabled?.length) return module === 'blog'
  return enabled.includes(module)
}
