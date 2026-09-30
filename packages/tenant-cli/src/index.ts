#!/usr/bin/env -S node --no-warnings --import tsx
import { parseArgs } from './args'
import { runCreate } from './commands/create'
import { runSync } from './commands/sync'
import { runDeploy } from './commands/deploy'
import { runMigrate } from './commands/migrate'
import { runImportBlog } from './commands/importBlog'

const HELP = `
tenant-cli — manage tenants in the dollarkoers monorepo

Commands:
  create   Scaffold a new tenant Astro app under apps/sites/<slug>/
           --slug <slug> --domain <domain> [--name "Display Name"] [--template <path>]

  sync     Pull a tenant's content from Payload into its local Astro app
           --slug <slug> [--site <path>] [--url <payload-url>] [--api-key <key>] [--no-clean]

  migrate  Import a WordPress export into Payload as a tenant
           --slug <slug> --domain <domain> [--wxr <wxr.xml>] [--scraped <scraped-dir>]

  deploy   Run sync + build + deploy inside the tenant site folder
           --slug <slug> [--site <path>] [--blog-path <path>]

  import-blog  Import markdown blog posts from a repo into Payload (one-time)
           --slug <slug> --site <path> [--blog-path <path>]

Globals (env or flag):
  PAYLOAD_URL            Payload server URL
  PAYLOAD_API_KEY        Super-admin API key (Users → Enable API Key) — required for sync unless DEPLOY_REPORT_TOKEN is set
  DEPLOY_REPORT_TOKEN     Optional CI service token (must match CMS server .env)
  TENANT                 Default --slug
`

async function main() {
  const args = parseArgs(process.argv)
  try {
    switch (args.command) {
      case 'create':
        return await runCreate(args)
      case 'sync':
      case 'sync:content':
        return await runSync(args)
      case 'migrate':
        return await runMigrate(args)
      case 'deploy':
        return await runDeploy(args)
      case 'import-blog':
        return await runImportBlog(args)
      case 'help':
      case undefined:
        console.log(HELP)
        return
      default:
        console.error(`Unknown command: ${args.command}`)
        console.log(HELP)
        process.exit(1)
    }
  } catch (err) {
    console.error('[tenant-cli] error:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

void main()
