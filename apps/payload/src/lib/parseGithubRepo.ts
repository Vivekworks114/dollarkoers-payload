/**
 * Normalize user input to `owner/repo` for GitHub API and actions/checkout.
 */
export function parseGithubRepo(input: string): { owner: string; repo: string; full: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let path = trimmed
    .replace(/^git@[^:]+:/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')

  const urlMatch = path.match(/github\.com[/:]([^/]+)\/([^/]+)/i)
  if (urlMatch) {
    path = `${urlMatch[1]}/${urlMatch[2]}`
  }

  if (!/^[\w.-]+\/[\w.-]+$/.test(path)) return null
  const parts = path.split('/')
  const owner = parts[0]
  const repo = parts[1]
  if (!owner || !repo) return null
  return { owner, repo, full: `${owner}/${repo}` }
}

export function resolveDeployMode(tenant: {
  githubRepo?: string | null
}): 'external' | 'monorepo' {
  const parsed = tenant.githubRepo ? parseGithubRepo(tenant.githubRepo) : null
  return parsed ? 'external' : 'monorepo'
}
