import type { Endpoint, PayloadRequest } from 'payload'

import { isCiServiceAuthorized } from '../access/ciServiceAuth'
import { runScheduledPublish } from '../lib/runScheduledPublish'

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Promote due scheduled blog posts and dispatch tenant deploys.
 *
 *   POST /api/scheduled-publish/run
 *
 * Auth: super-admin API key or `x-deploy-report-token` (= DEPLOY_REPORT_TOKEN).
 * Call from GitHub Actions cron (`.github/workflows/scheduled-publish.yml`) or VPS cron.
 */
export const scheduledPublishEndpoint: Endpoint = {
  path: '/scheduled-publish/run',
  method: 'post',
  handler: async (req) => {
    if (!isCiServiceAuthorized(req)) {
      return json(
        {
          ok: false,
          message:
            'Unauthorized. Use a super-admin API key or x-deploy-report-token (DEPLOY_REPORT_TOKEN).',
        },
        401,
      )
    }

    const result = await runScheduledPublish(req.payload)

    return json({
      ok: true,
      promoted: result.promoted,
      tenantsTriggered: result.tenantsTriggered,
      deploys: result.deploys,
      message:
        result.promoted > 0
          ? `Promoted ${result.promoted} post(s); triggered ${result.tenantsTriggered} deploy(s).`
          : 'No scheduled posts were due.',
    })
  },
}
