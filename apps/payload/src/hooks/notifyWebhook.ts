import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  PayloadRequest,
} from 'payload'

/**
 * Legacy auto-deploy hook (disabled on content collections).
 *
 * Production uses manual "Publish content" instead of deploy-on-save.
 * To re-enable auto-deploy per tenant, wire `afterChangeNotify` back on
 * collections and set `webhookEnabled` on the tenant row.
 *
 * Build the payload sent to the webhook receiver. Anything that needs to
 * route a rebuild MUST go here:
 *   - tenant.slug   -> picks the GitHub Actions workflow run
 *   - collection    -> for logging / selective syncs in future
 *   - id            -> the changed document's ID
 *   - operation     -> create | update | delete
 */
type WebhookEvent = {
  tenantSlug: string
  collection: string
  id: string | number
  operation: 'create' | 'update' | 'delete'
}

async function send(event: WebhookEvent): Promise<void> {
  const url = process.env.WEBHOOK_URL
  const token = process.env.WEBHOOK_TOKEN
  if (!url || !token) return

  // Treat the example placeholder URLs from .env.example as "not configured"
  // so local dev doesn't spam DNS failures.
  if (/(^|\W)example\.com(\W|$)/.test(url) || /(^|\W)example\.org(\W|$)/.test(url)) {
    return
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-token': token,
      },
      body: JSON.stringify(event),
    })
  } catch (err) {
    // Don't shout on network errors during bulk imports / local dev. Keep
    // the log line short so it doesn't drown out actual import progress.
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[notifyWebhook] dispatch failed (${message})`)
  }
}

async function resolveTenantSlug(
  req: PayloadRequest,
  tenantRef: unknown,
): Promise<string | null> {
  if (!tenantRef) return null
  if (typeof tenantRef === 'object' && tenantRef !== null && 'slug' in (tenantRef as Record<string, unknown>)) {
    const slug = (tenantRef as Record<string, unknown>).slug
    if (typeof slug === 'string') return slug
  }
  if (!req.payload) return null
  try {
    const tenant = (await req.payload.findByID({
      collection: 'tenants',
      id: tenantRef as string | number,
    })) as { slug?: string; webhookEnabled?: boolean } | null
    if (!tenant?.slug) return null
    if (tenant.webhookEnabled === false) return null
    return tenant.slug
  } catch {
    return null
  }
}

export const afterChangeNotify: CollectionAfterChangeHook = async ({ doc, operation, collection, req }) => {
  const slug = await resolveTenantSlug(req, (doc as { tenant?: unknown }).tenant)
  if (!slug) return doc
  await send({
    tenantSlug: slug,
    collection: collection.slug,
    id: (doc as { id: string | number }).id,
    operation: operation as 'create' | 'update',
  })
  return doc
}

export const afterDeleteNotify: CollectionAfterDeleteHook = async ({ doc, collection, req }) => {
  const slug = await resolveTenantSlug(req, (doc as { tenant?: unknown }).tenant)
  if (!slug) return
  await send({
    tenantSlug: slug,
    collection: collection.slug,
    id: (doc as { id: string | number }).id,
    operation: 'delete',
  })
}
