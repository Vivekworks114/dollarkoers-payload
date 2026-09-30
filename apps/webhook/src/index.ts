/**
 * Payload -> GitHub Actions dispatcher.
 *
 * Receives `{ tenantSlug, collection, id, operation }` events from Payload's
 * afterChange/afterDelete hooks and triggers the matching tenant deploy
 * workflow on GitHub. Coalescing is handled by GitHub Actions'
 * `concurrency` group (see .github/workflows/tenant-deploy.yml).
 *
 * Bindings (set via wrangler secret put):
 *   WEBHOOK_TOKEN     - shared secret. Must match Payload's WEBHOOK_TOKEN.
 *   GITHUB_TOKEN      - PAT or fine-grained token with `actions:write` on the repo.
 *   GITHUB_OWNER      - e.g. "yourorg"
 *   GITHUB_REPO       - e.g. "dollarkoers"
 *   WORKFLOW_FILE     - workflow filename, default "tenant-deploy.yml"
 *   BRANCH            - branch to run on, default "main"
 */

interface Env {
  WEBHOOK_TOKEN: string
  GITHUB_TOKEN: string
  GITHUB_OWNER: string
  GITHUB_REPO: string
  WORKFLOW_FILE?: string
  BRANCH?: string
}

interface IncomingEvent {
  tenantSlug?: string
  collection?: string
  id?: string | number
  operation?: 'create' | 'update' | 'delete'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const token = request.headers.get('x-webhook-token')
    if (!env.WEBHOOK_TOKEN || token !== env.WEBHOOK_TOKEN) {
      return new Response('Unauthorized', { status: 401 })
    }

    let event: IncomingEvent
    try {
      event = (await request.json()) as IncomingEvent
    } catch {
      return new Response('Bad Request', { status: 400 })
    }

    if (!event.tenantSlug || !/^[a-z0-9-]+$/.test(event.tenantSlug)) {
      return new Response('Invalid tenantSlug', { status: 400 })
    }

    const workflow = env.WORKFLOW_FILE || 'tenant-deploy.yml'
    const branch = env.BRANCH || 'main'
    const dispatchUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`

    const res = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'dollarkoers-webhook',
      },
      body: JSON.stringify({
        ref: branch,
        inputs: {
          tenant_slug: event.tenantSlug,
          reason: `${event.collection ?? '?'}/${event.id ?? '?'} (${event.operation ?? '?'})`,
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return new Response(`GitHub dispatch failed: ${res.status} ${text}`, { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true, dispatched: event.tenantSlug }), {
      headers: { 'content-type': 'application/json' },
    })
  },
}
