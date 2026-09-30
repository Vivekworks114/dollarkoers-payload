/**
 * Optional local dev: pull blog markdown from Payload into this repo.
 * Requires .env.dollarkoers with PAYLOAD_URL and PAYLOAD_API_KEY.
 *
 *   node scripts/sync-content.mjs
 *
 * Production publish runs sync in GitHub Actions — you do not commit synced files.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(root, '..')
const configPath = path.join(repoRoot, 'dollarkoers.config.json')
const envPath = path.join(repoRoot, '.env.dollarkoers')

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('Create .env.dollarkoers with PAYLOAD_URL, PAYLOAD_API_KEY, TENANT')
    process.exit(1)
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

loadEnv()
const tenant = process.env.TENANT
if (!tenant) {
  console.error('Set TENANT=your-slug in .env.dollarkoers')
  process.exit(1)
}

let blogPath = 'src/content/blog'
if (existsSync(configPath)) {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
  if (cfg.blogContentPath) blogPath = cfg.blogContentPath
}

console.log(`Syncing blog for tenant ${tenant} → ${blogPath}`)
const platform = process.env.DOLLARKOERS_PLATFORM_ROOT
if (!platform) {
  console.error(
    'Set DOLLARKOERS_PLATFORM_ROOT to your dollarkoers monorepo path, then run:\n' +
      '  pnpm tenant-cli sync --slug $TENANT --site . --blog-path ' +
      blogPath,
  )
  process.exit(1)
}

const r = spawnSync(
  'pnpm',
  ['tenant-cli', 'sync', '--slug', tenant, '--site', repoRoot, '--blog-path', blogPath],
  { cwd: platform, stdio: 'inherit', env: process.env },
)
process.exit(r.status ?? 1)
