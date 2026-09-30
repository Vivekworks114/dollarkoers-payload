import type { CollectionAfterDeleteHook, CollectionBeforeDeleteHook } from 'payload'

import { isSuperAdmin } from '../access/isSuperAdmin'
import { payloadLog } from './payloadLogger'

const CLEANUP_COLLECTIONS = ['blog-posts', 'media'] as const
/** Return the HTTP response even if related cleanup is still running. */
const CLEANUP_TIMEOUT_MS = 45_000

export const tenantBeforeDeleteHook: CollectionBeforeDeleteHook = ({ id, req }) => {
  payloadLog.tenant('delete.request', {
    tenantId: id,
    userId: req.user?.id ?? null,
    email: (req.user as { email?: string } | null)?.email ?? null,
    superAdmin: isSuperAdmin(req.user),
  })
  return id
}

export const tenantAfterDeleteHook: CollectionAfterDeleteHook = async ({ id, req }) => {
  const tenantId = id
  payloadLog.tenant('delete.row_removed', { tenantId })

  const jobs: Promise<void>[] = []

  for (const collection of CLEANUP_COLLECTIONS) {
    jobs.push(
      req.payload
        .delete({
          collection,
          overrideAccess: true,
          where: { tenant: { in: [tenantId] } },
        })
        .then((result) => {
          const count = Array.isArray(result?.docs) ? result.docs.length : 0
          payloadLog.tenant('delete.cleanup_ok', { tenantId, collection, deleted: count })
        })
        .catch((err) => {
          payloadLog.tenant('delete.cleanup_failed', { tenantId, collection }, err)
        }),
    )
  }

  jobs.push(
    (async () => {
      try {
        const usersWithTenant = await req.payload.find({
          collection: 'users',
          depth: 0,
          limit: 200,
          overrideAccess: true,
          where: { 'tenants.tenant': { in: [tenantId] } },
        })

        for (const user of usersWithTenant.docs ?? []) {
          const tenants = (user.tenants ?? []).filter((row) => {
            const ref = row?.tenant
            const tid =
              ref != null && typeof ref === 'object' && 'id' in ref
                ? (ref as { id: unknown }).id
                : ref
            return tid != null && String(tid) !== String(tenantId)
          })

          await req.payload.update({
            collection: 'users',
            id: user.id,
            overrideAccess: true,
            data: { tenants },
          })
        }

        payloadLog.tenant('delete.users_updated', {
          tenantId,
          users: usersWithTenant.docs?.length ?? 0,
        })
      } catch (err) {
        payloadLog.tenant('delete.users_failed', { tenantId }, err)
      }
    })(),
  )

  try {
    await Promise.race([
      Promise.all(jobs),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`tenant cleanup exceeded ${CLEANUP_TIMEOUT_MS}ms`)),
          CLEANUP_TIMEOUT_MS,
        )
      }),
    ])
    payloadLog.tenant('delete.complete', { tenantId })
  } catch (err) {
    payloadLog.tenant('delete.cleanup_slow', { tenantId, note: formatErr(err) })
  }
}

function formatErr(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
