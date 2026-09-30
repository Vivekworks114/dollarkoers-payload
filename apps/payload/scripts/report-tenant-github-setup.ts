#!/usr/bin/env tsx
/**
 * Report GitHub repo setup status back to Payload (CI or client repo workflow).
 *
 *   pnpm report:github-setup -- --slug keukenfaqs --status ready
 *   pnpm report:github-setup -- --slug keukenfaqs --status setup_dispatched --pr-url https://github.com/...
 */
interface Args {
  slug: string
  status: string
  prUrl?: string
  notes?: string
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
    }
  }
  const slug = out.slug
  const status = out.status
  if (!slug || !status) {
    console.error(
      'Usage: report-tenant-github-setup --slug <slug> --status <not_connected|validated|setup_dispatched|ready|failed> [--pr-url URL] [--notes text] [--error MSG]',
    )
    process.exit(1)
  }
  return {
    slug,
    status,
    prUrl: out['pr-url'],
    notes: out.notes,
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

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey) headers.Authorization = `users API-Key ${apiKey}`
  if (reportToken) headers['x-deploy-report-token'] = reportToken

  const res = await fetch(`${baseUrl}/api/tenants/report-github-setup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      slug: args.slug,
      status: args.status,
      prUrl: args.prUrl,
      notes: args.notes,
      error: args.error,
    }),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`Report failed (${res.status}): ${text}`)
    process.exit(1)
  }
  console.log(text)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
