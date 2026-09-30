#!/usr/bin/env tsx
/**
 * Report deploy or scaffold status back to Payload (used from GitHub Actions).
 *
 *   pnpm report:deploy -- --slug keukenfaqs --status success --workers-url https://...
 *   pnpm report:deploy -- --slug keukenfaqs --status failure --error "build failed"
 *   pnpm report:deploy -- --slug keukenfaqs --status in_progress --run-url https://github.com/...
 *   pnpm report:deploy -- --kind scaffold --slug keukenfaqs --status success --pr-url https://...
 */
import { productionUrlFromDomain } from '../src/lib/tenantDeployStatus'

interface Args {
  kind: 'deploy' | 'scaffold'
  slug: string
  status: string
  workersUrl?: string
  previewUrl?: string
  runUrl?: string
  prUrl?: string
  error?: string
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a?.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    } else {
      out[key] = 'true'
    }
  }

  const slug = out.slug
  const status = out.status
  if (!slug || !status) {
    console.error(
      'Usage: report-tenant-deploy --slug <slug> --status <idle|dispatched|in_progress|success|failure> [--kind deploy|scaffold] [--workers-url URL] [--run-url URL] [--pr-url URL] [--error MSG]',
    )
    process.exit(1)
  }

  return {
    kind: out.kind === 'scaffold' ? 'scaffold' : 'deploy',
    slug,
    status,
    workersUrl: out['workers-url'],
    previewUrl: out['preview-url'],
    runUrl: out['run-url'] ?? process.env.GITHUB_RUN_URL,
    prUrl: out['pr-url'],
    error: out.error,
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
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

  const path = args.kind === 'scaffold' ? '/api/tenants/report-scaffold' : '/api/tenants/report-deploy'
  const body: Record<string, string | null | undefined> = {
    slug: args.slug,
    status: args.status,
    runUrl: args.runUrl,
    error: args.error,
  }

  if (args.kind === 'deploy') {
    body.workersDevUrl = args.workersUrl
    body.previewUrl = args.previewUrl ?? args.workersUrl
  } else {
    body.prUrl = args.prUrl
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  // Prefer shared token (CI); API key requires Users.useAPIKey + super-admin role.
  if (reportToken) headers['x-deploy-report-token'] = reportToken
  else if (apiKey) headers.Authorization = `users API-Key ${apiKey}`

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`Report failed (${res.status}): ${text}`)
    if (res.status === 401) {
      console.error(
        'Fix: set matching DEPLOY_REPORT_TOKEN in Payload .env AND GitHub Actions secrets, ' +
          'or PAYLOAD_API_KEY from a super-admin user (Users → Enable API Key). ' +
          `PAYLOAD_URL=${baseUrl} auth=${reportToken ? 'token' : apiKey ? 'api-key' : 'none'}`,
      )
    }
    process.exit(1)
  }

  console.log(text)

  if (args.kind === 'deploy' && args.status === 'success') {
    const domain = process.env.TENANT_DOMAIN
    const production = productionUrlFromDomain(domain)
    if (production) {
      console.log(`Production URL (after custom domain in Cloudflare): ${production}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
