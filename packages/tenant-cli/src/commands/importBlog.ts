import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { optionalFlag, requireFlag, type ParsedArgs } from '../args'

/**
 * `tenant-cli import-blog --slug <slug> --site <path> [--blog-path <path>]`
 */
export async function runImportBlog(args: ParsedArgs): Promise<void> {
  const slug = requireFlag(args, 'slug')
  const site = requireFlag(args, 'site')
  const blogPath = optionalFlag(args, 'blog-path') ?? 'src/content/blog'

  const payloadRoot = path.resolve(process.cwd(), 'apps/payload')
  const scriptArgs = [
    '--filter',
    '@dollarkoers/payload',
    'import:blog-from-repo',
    '--',
    '--slug',
    slug,
    '--site',
    path.resolve(site),
    '--blog-path',
    blogPath,
  ]

  console.log(`[tenant-cli import-blog] ${scriptArgs.join(' ')}`)
  const result = spawnSync('pnpm', scriptArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`import-blog exited with code ${result.status}`)
  }
}
