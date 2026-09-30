/**
 * Shared deploy/scaffold status values stored on the `tenants` collection.
 */

export const DEPLOY_STATUSES = [
  'idle',
  'dispatched',
  'in_progress',
  'success',
  'failure',
] as const

export type DeployStatus = (typeof DEPLOY_STATUSES)[number]

export const SCAFFOLD_STATUSES = ['idle', 'dispatched', 'in_progress', 'success', 'failure'] as const

export type ScaffoldStatus = (typeof SCAFFOLD_STATUSES)[number]

export function productionUrlFromDomain(domain: string | null | undefined): string | null {
  if (!domain || typeof domain !== 'string') return null
  const trimmed = domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!trimmed) return null
  return `https://${trimmed}`
}

export function workersDevUrlFromParts(
  slug: string,
  subdomain: string | null | undefined,
): string | null {
  if (!subdomain?.trim()) return null
  return `https://${slug}.${subdomain.trim()}.workers.dev`
}

export interface ReportDeployBody {
  slug: string
  status: DeployStatus
  workersDevUrl?: string | null
  previewUrl?: string | null
  runUrl?: string | null
  error?: string | null
}

export interface ReportScaffoldBody {
  slug: string
  status: ScaffoldStatus
  runUrl?: string | null
  prUrl?: string | null
  error?: string | null
}
