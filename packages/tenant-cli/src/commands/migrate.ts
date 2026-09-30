import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { optionalFlag, requireFlag, type ParsedArgs } from '../args'

/**
 * `tenant-cli migrate --slug <slug> --domain <domain> [--wxr <path>]`
 *
 * Imports WordPress blog posts into Payload (`blog-posts` only).
 */
export async function runMigrate(args: ParsedArgs): Promise<void> {
  const slug = requireFlag(args, 'slug')
  const domain = requireFlag(args, 'domain')
  const wxr = optionalFlag(args, 'wxr')
  const scraped = optionalFlag(args, 'scraped')
  const cwd = process.cwd()
  const payloadRoot = path.resolve(path.join(cwd, 'apps/payload'))
  const env = { ...process.env, TENANT_SLUG: slug, TENANT_DOMAIN: domain }

  if (scraped) {
    console.warn('[tenant-cli migrate] --scraped is no longer supported (blog-only CMS). Ignoring.')
  }

  if (wxr) {
    const wxrPath = path.resolve(wxr)
    console.log(`[tenant-cli migrate] WXR -> Payload blog-posts (${wxrPath})`)
    const result = spawnSync(
      'pnpm',
      ['run', 'migrate:wxr', '--', '--wxr', wxrPath, '--slug', slug, '--domain', domain],
      { cwd: payloadRoot, env, stdio: 'inherit' },
    )
    if (result.status !== 0) throw new Error('migrate:wxr failed')
  }

  console.log('[tenant-cli migrate] complete. Now run:')
  console.log(`  pnpm tenant-cli sync --slug ${slug}`)
}
