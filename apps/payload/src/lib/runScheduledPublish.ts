import type { Payload } from 'payload'
import type { Where } from 'payload'

import { dueScheduledPostsWhere } from '@dollarkoers/payload-sdk'

import {
  dispatchTenantDeployWithPayload,
  type DispatchTenantDeployResult,
  type TenantDeployTarget,
} from './dispatchTenantDeploy'

export interface ScheduledPublishResult {
  promoted: number
  tenantsTriggered: number
  deploys: Array<{ tenantSlug: string; ok: boolean; message: string; runUrl?: string | null }>
}

function tenantIdFromRef(tenant: unknown): string | number | null {
  if (tenant == null) return null
  if (typeof tenant === 'string' || typeof tenant === 'number') return tenant
  if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
    const id = (tenant as { id: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

/**
 * Promote due scheduled posts to published and dispatch tenant deploy for each affected site.
 */
export async function runScheduledPublish(payload: Payload): Promise<ScheduledPublishResult> {
  const now = new Date()
  const due = await payload.find({
    collection: 'blog-posts',
    where: dueScheduledPostsWhere(now) as Where,
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  const tenantIds = new Set<string | number>()
  let promoted = 0

  for (const doc of due.docs) {
    await payload.update({
      collection: 'blog-posts',
      id: doc.id,
      data: { publishStatus: 'published' },
      overrideAccess: true,
    })
    promoted++
    const tid = tenantIdFromRef((doc as { tenant?: unknown }).tenant)
    if (tid != null) tenantIds.add(tid)
  }

  const deploys: ScheduledPublishResult['deploys'] = []
  let tenantsTriggered = 0

  for (const tenantId of tenantIds) {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })) as TenantDeployTarget | null

    if (!tenant?.slug) continue

    const result: DispatchTenantDeployResult = await dispatchTenantDeployWithPayload(
      payload,
      tenant,
      'scheduled blog publish',
    )

    deploys.push({
      tenantSlug: tenant.slug,
      ok: result.ok,
      message: result.message,
      runUrl: result.runUrl,
    })
    if (result.ok) tenantsTriggered++
  }

  return { promoted, tenantsTriggered, deploys }
}
