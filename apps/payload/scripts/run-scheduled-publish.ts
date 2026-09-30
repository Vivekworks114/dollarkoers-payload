#!/usr/bin/env tsx
/**
 * Promote due scheduled blog posts and dispatch tenant deploys.
 *
 *   pnpm scheduled-publish:run
 *
 * Requires PAYLOAD_URL and PAYLOAD_API_KEY or DEPLOY_REPORT_TOKEN.
 * Same auth as GitHub Actions cron (`.github/workflows/scheduled-publish.yml`).
 */
async function main(): Promise<void> {
  const baseUrl = (process.env.PAYLOAD_URL ?? '').replace(/\/+$/, '')
  const apiKey = process.env.PAYLOAD_API_KEY
  const reportToken = process.env.DEPLOY_REPORT_TOKEN

  if (!baseUrl) {
    console.error('PAYLOAD_URL is required')
    process.exit(1)
  }
  if (!apiKey && !reportToken) {
    console.error('PAYLOAD_API_KEY or DEPLOY_REPORT_TOKEN is required')
    process.exit(1)
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (reportToken) headers['x-deploy-report-token'] = reportToken
  else if (apiKey) headers.Authorization = `users API-Key ${apiKey}`

  const res = await fetch(`${baseUrl}/api/scheduled-publish/run`, {
    method: 'POST',
    headers,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`Scheduled publish failed (${res.status}): ${text}`)
    process.exit(1)
  }

  console.log(text)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
