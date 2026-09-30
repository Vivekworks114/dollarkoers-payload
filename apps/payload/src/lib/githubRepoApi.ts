const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'dollarkoers-admin',
} as const

export interface RepoValidationResult {
  ok: boolean
  message: string
  notes: string[]
  astroConfig?: string | null
  blogPathExists?: boolean
  packageManager?: 'pnpm' | 'npm' | 'unknown'
}

export async function validateGithubRepository(opts: {
  repoFull: string
  branch: string
  blogContentPath: string
  /** When omitted, uses GITHUB_TOKEN / EXTERNAL_REPO_GITHUB_TOKEN from env. */
  token?: string | null
}): Promise<RepoValidationResult> {
  const token =
    opts.token?.trim() ||
    process.env.EXTERNAL_REPO_GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    null
  if (!token) {
    return {
      ok: false,
      message:
        'No GitHub token. Link a credential on the tenant, or set EXTERNAL_REPO_GITHUB_TOKEN / GITHUB_TOKEN in apps/payload/.env.',
      notes: [],
    }
  }

  const parts = opts.repoFull.split('/')
  const owner = parts[0]
  const repo = parts[1]
  if (!owner || !repo) {
    return { ok: false, message: 'Invalid repository format.', notes: [] }
  }
  const notes: string[] = []

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, ...GITHUB_HEADERS },
  })
  if (!repoRes.ok) {
    return {
      ok: false,
      message: `Repository not found or not accessible (${repoRes.status}).`,
      notes: [`GET /repos/${owner}/${repo} failed`],
    }
  }
  notes.push(`Repository ${opts.repoFull} is accessible.`)

  const branchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(opts.branch)}`,
    { headers: { Authorization: `Bearer ${token}`, ...GITHUB_HEADERS } },
  )
  if (!branchRes.ok) {
    return {
      ok: false,
      message: `Branch "${opts.branch}" not found.`,
      notes,
    }
  }
  notes.push(`Branch "${opts.branch}" exists.`)

  const astroPaths = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js']
  let astroConfig: string | null = null
  for (const p of astroPaths) {
    const exists = await pathExists(token, owner, repo, opts.branch, p)
    if (exists) {
      astroConfig = p
      notes.push(`Found ${p}.`)
      break
    }
  }
  if (!astroConfig) {
    return {
      ok: false,
      message: 'No astro.config.{mjs,ts,js} found at repository root.',
      notes,
      astroConfig: null,
    }
  }

  const blogPath = opts.blogContentPath.replace(/^\/+/, '')
  const blogExists = await pathExists(token, owner, repo, opts.branch, blogPath)
  if (blogExists) {
    notes.push(`Blog path "${blogPath}" exists.`)
  } else {
    notes.push(
      `Blog path "${blogPath}" not found yet — run "Setup repository" or create it before first publish.`,
    )
  }

  let packageManager: RepoValidationResult['packageManager'] = 'unknown'
  if (await pathExists(token, owner, repo, opts.branch, 'pnpm-lock.yaml')) {
    packageManager = 'pnpm'
    notes.push('Uses pnpm (pnpm-lock.yaml).')
  } else if (await pathExists(token, owner, repo, opts.branch, 'package-lock.json')) {
    packageManager = 'npm'
    notes.push('Uses npm (package-lock.json).')
  } else {
    notes.push('No lockfile detected; CI will fall back to npm install.')
  }

  const integration = await pathExists(
    token,
    owner,
    repo,
    opts.branch,
    'dollarkoers.config.json',
  )
  if (integration) {
    notes.push('dollarkoers.config.json present (repo integration ready).')
  }

  return {
    ok: true,
    message: blogExists
      ? 'Repository looks ready for Payload blog publish.'
      : 'Repository is valid; complete setup or add the blog content folder.',
    notes,
    astroConfig,
    blogPathExists: blogExists,
    packageManager,
  }
}

async function pathExists(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
): Promise<boolean> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...GITHUB_HEADERS },
  })
  return res.ok
}
