import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { optionalFlag, type ParsedArgs } from '../args'

function packageManager(siteRoot: string): 'pnpm' | 'npm' {
  if (fs.existsSync(path.join(siteRoot, 'pnpm-lock.yaml'))) return 'pnpm'
  return 'npm'
}

/**
 * `tenant-cli deploy --slug <slug> [--site <path>]`
 *
 * Runs sync + build + deploy in the tenant site directory.
 */
export async function runDeploy(args: ParsedArgs): Promise<void> {
  const slug = optionalFlag(args, 'slug') ?? process.env.TENANT
  if (!slug) throw new Error('--slug or TENANT env var is required')

  const siteRoot = path.resolve(
    optionalFlag(args, 'site') ?? path.join(process.cwd(), 'apps/sites', slug),
  )
  const env = { ...process.env, TENANT: slug }
  const pkg = packageManager(siteRoot)
  const run = (script: string) => {
    const cmd = pkg === 'pnpm' ? 'pnpm' : 'npm'
    const args = pkg === 'pnpm' ? ['run', script] : ['run', script]
    console.log(`[tenant-cli deploy] -> ${cmd} ${args.join(' ')} (${siteRoot})`)
    const result = spawnSync(cmd, args, { cwd: siteRoot, env, stdio: 'inherit' })
    if (result.status !== 0) {
      throw new Error(`${cmd} ${script} exited with code ${result.status}`)
    }
  }

  const platformRoot = process.cwd()
  const syncArgs = ['tenant-cli', 'sync', '--slug', slug, '--site', siteRoot]
  const blogPath = optionalFlag(args, 'blog-path')
  if (blogPath) syncArgs.push('--blog-path', blogPath)

  console.log(`[tenant-cli deploy] -> pnpm ${syncArgs.join(' ')}`)
  const syncResult = spawnSync('pnpm', syncArgs, { cwd: platformRoot, env, stdio: 'inherit' })
  if (syncResult.status !== 0) {
    throw new Error(`sync exited with code ${syncResult.status}`)
  }

  for (const script of ['build', 'deploy']) {
    run(script)
  }
}
