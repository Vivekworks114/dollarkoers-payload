import type { PayloadRequest } from 'payload'

import { isSuperAdmin } from './isSuperAdmin'

/**
 * Super-admins and tenant-scoped editors (tenant-admin / editor) may publish
 * content for tenants they are assigned to via the multi-tenant plugin.
 */
export function canPublishTenant(user: unknown, tenantId: string | number): boolean {
  if (!user || typeof user !== 'object') return false
  if (isSuperAdmin(user)) return true

  const roles = (user as { roles?: unknown }).roles
  if (!Array.isArray(roles)) return false
  const canRole = roles.includes('tenant-admin') || roles.includes('editor')
  if (!canRole) return false

  const tenants = (user as { tenants?: unknown }).tenants
  if (!Array.isArray(tenants)) return false

  const want = String(tenantId)
  return tenants.some((entry) => tenantIdMatches(entry, want))
}

export function canPublishTenantRequest(req: PayloadRequest, tenantId: string | number): boolean {
  return canPublishTenant(req.user, tenantId)
}

function tenantIdMatches(entry: unknown, want: string): boolean {
  if (entry == null) return false
  if (typeof entry === 'number' || typeof entry === 'string') return String(entry) === want

  if (typeof entry === 'object') {
    const row = entry as Record<string, unknown>
    if ('tenant' in row) {
      const tenant = row.tenant
      if (tenant == null) return false
      if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
        return String((tenant as { id: unknown }).id) === want
      }
      return String(tenant) === want
    }
    if ('id' in row) return String(row.id) === want
  }

  return false
}
